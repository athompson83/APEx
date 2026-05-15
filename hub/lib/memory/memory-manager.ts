/**
 * MemoryManager — CRUD and semantic retrieval for agent memories.
 *
 * Memories are stored in the `memories` Postgres table (managed by Prisma).
 * Search combines simple SQL keyword matching with an optional vector-store
 * semantic search when the VectorStore is available.
 *
 * Memory extraction from conversations is powered by Claude.
 */

import { PrismaClient, MemoryType, AgentType, Prisma } from '@prisma/client';
import type { AgentMessage } from '@/lib/agents/types';
import { completeWithClaude } from '@/lib/ai/anthropic';
import { FAST_MODEL } from '@/lib/ai/anthropic';
import { getVectorStore } from '@/lib/memory/vector-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NewMemoryInput {
  content: string;
  /** One of: FACT | PREFERENCE | CONTEXT | DECISION | RELATIONSHIP */
  type: MemoryType;
  /** Confidence score 0–1 (default 1.0). */
  confidence?: number;
  tags?: string[];
  agentType?: AgentType;
  sourceConversationId?: string;
  sourceDocumentId?: string;
  /** Optional TTL — memory is auto-expired after this date. */
  expiresAt?: Date;
}

/** Shape returned by all public read methods. */
export interface Memory {
  id: string;
  organizationId: string;
  agentType: AgentType | null;
  content: string;
  summary: string | null;
  type: MemoryType;
  /** Stored as Prisma Decimal; returned as number for convenience. */
  confidence: number;
  tags: string[];
  expiresAt: Date | null;
  approved: boolean;
  sourceDocumentId: string | null;
  sourceConversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  _prisma = new PrismaClient();
  return _prisma;
}

function prismaToMemory(
  row: Awaited<ReturnType<PrismaClient['memory']['findFirst']>>
): Memory {
  if (!row) throw new Error('Memory row is null');
  return {
    id: row.id,
    organizationId: row.organizationId,
    agentType: row.agentType,
    content: row.content,
    summary: row.summary,
    type: row.type,
    confidence: parseFloat(String(row.confidence)),
    tags: row.tags,
    expiresAt: row.expiresAt,
    approved: row.approved,
    sourceDocumentId: row.sourceDocumentId,
    sourceConversationId: row.sourceConversationId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── MemoryManager ────────────────────────────────────────────────────────────

export class MemoryManager {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrisma();
  }

  // ─── addMemory ────────────────────────────────────────────────────────────

  /**
   * Persists a new memory for the given organisation.
   * Tags are de-duplicated and lowercased for consistent matching.
   */
  async addMemory(orgId: string, memory: NewMemoryInput): Promise<Memory> {
    const normalizedTags = (memory.tags ?? [])
      .map((t) => t.toLowerCase().trim())
      .filter(Boolean);

    const row = await this.prisma.memory.create({
      data: {
        organizationId: orgId,
        content: memory.content,
        type: memory.type,
        confidence: new Prisma.Decimal(memory.confidence ?? 1.0),
        tags: normalizedTags,
        agentType: memory.agentType ?? null,
        sourceConversationId: memory.sourceConversationId ?? null,
        sourceDocumentId: memory.sourceDocumentId ?? null,
        expiresAt: memory.expiresAt ?? null,
        approved: true,
      },
    });

    return prismaToMemory(row);
  }

  // ─── getMemories ──────────────────────────────────────────────────────────

  /**
   * Returns approved, non-expired memories for an organisation.
   * Optionally filters by agentType.
   *
   * @param orgId      Organisation identifier.
   * @param agentType  If supplied, returns memories for this agent only
   *                   plus those with agentType = null (global memories).
   * @param limit      Maximum records to return (default 50).
   */
  async getMemories(
    orgId: string,
    agentType?: AgentType,
    limit = 50
  ): Promise<Memory[]> {
    const now = new Date();

    const where: Prisma.MemoryWhereInput = {
      organizationId: orgId,
      approved: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    if (agentType) {
      where.OR = [
        { agentType },
        { agentType: null },
        ...(where.OR as Prisma.MemoryWhereInput[]),
      ];
      // Keep the expiry OR as a nested condition.
      where.AND = [
        {
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        {
          OR: [{ agentType }, { agentType: null }],
        },
      ];
      delete where.OR;
    }

    const rows = await this.prisma.memory.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return rows.map(prismaToMemory);
  }

  // ─── searchMemories ───────────────────────────────────────────────────────

  /**
   * Hybrid search: keyword SQL match + optional vector-store semantic results.
   *
   * Steps:
   * 1. Runs a case-insensitive keyword search against `content` in Postgres.
   * 2. Attempts a semantic search via VectorStore against document chunks
   *    (memories themselves are not embedded; this finds related doc context).
   * 3. Merges and deduplicates, preferring SQL hits first.
   *
   * @param query     Free-text search string.
   * @param orgId     Scopes results.
   * @param agentType Optional agent scope.
   */
  async searchMemories(
    query: string,
    orgId: string,
    agentType?: AgentType
  ): Promise<Memory[]> {
    const now = new Date();
    const terms = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `%${t}%`);

    if (terms.length === 0) return [];

    // Build Prisma OR for each term
    const contentClauses: Prisma.MemoryWhereInput[] = terms.map((term) => ({
      content: { contains: term.slice(1, -1), mode: 'insensitive' as const },
    }));

    const where: Prisma.MemoryWhereInput = {
      organizationId: orgId,
      approved: true,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: contentClauses },
        ...(agentType
          ? [{ OR: [{ agentType }, { agentType: null as AgentType | null }] }]
          : []),
      ],
    };

    const rows = await this.prisma.memory.findMany({
      where,
      orderBy: [{ confidence: 'desc' }, { updatedAt: 'desc' }],
      take: 30,
    });

    const sqlResults = rows.map(prismaToMemory);

    // Attempt semantic search for additional context — best-effort only.
    let semanticIds: Set<string> = new Set();
    try {
      const vectorStore = getVectorStore();
      const semanticResults = await vectorStore.searchSimilar(
        query,
        orgId,
        10,
        agentType ? { agentType } : undefined
      );
      semanticIds = new Set(semanticResults.map((r) => r.documentId));
    } catch {
      // Non-fatal: vector store may not be configured.
    }

    // Surface memories that are linked to semantically matched documents.
    let semanticMemories: Memory[] = [];
    if (semanticIds.size > 0) {
      const linkedRows = await this.prisma.memory.findMany({
        where: {
          organizationId: orgId,
          approved: true,
          sourceDocumentId: { in: [...semanticIds] },
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        },
        orderBy: { confidence: 'desc' },
        take: 10,
      });
      semanticMemories = linkedRows.map(prismaToMemory);
    }

    // Merge: SQL hits first, then semantically linked memories (deduplicated).
    const seen = new Set(sqlResults.map((m) => m.id));
    const merged = [...sqlResults];
    for (const m of semanticMemories) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        merged.push(m);
      }
    }

    return merged;
  }

  // ─── updateMemory ─────────────────────────────────────────────────────────

  /**
   * Applies partial updates to an existing memory record.
   */
  async updateMemory(
    id: string,
    updates: Partial<Omit<Memory, 'id' | 'organizationId' | 'createdAt' | 'updatedAt'>>
  ): Promise<Memory> {
    const data: Prisma.MemoryUpdateInput = {};

    if (updates.content !== undefined) data.content = updates.content;
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.confidence !== undefined)
      data.confidence = new Prisma.Decimal(updates.confidence);
    if (updates.tags !== undefined) data.tags = updates.tags;
    if (updates.agentType !== undefined) data.agentType = updates.agentType;
    if (updates.approved !== undefined) data.approved = updates.approved;
    if (updates.expiresAt !== undefined) data.expiresAt = updates.expiresAt;
    if (updates.summary !== undefined) data.summary = updates.summary;

    const row = await this.prisma.memory.update({ where: { id }, data });
    return prismaToMemory(row);
  }

  // ─── deleteMemory ─────────────────────────────────────────────────────────

  /** Hard-deletes a memory record. */
  async deleteMemory(id: string): Promise<void> {
    await this.prisma.memory.delete({ where: { id } });
  }

  // ─── extractMemoriesFromConversation ──────────────────────────────────────

  /**
   * Uses Claude to analyse a conversation and extract structured memories
   * (facts, decisions, preferences, etc.) worth persisting.
   *
   * @param messages   Ordered conversation messages.
   * @param agentType  The agent involved (used as context in the prompt).
   * @param orgId      Organisation scope (informational for the prompt).
   * @returns          Array of NewMemoryInput objects ready to be persisted
   *                   via `addMemory()`.
   */
  async extractMemoriesFromConversation(
    messages: AgentMessage[],
    agentType: string,
    orgId: string
  ): Promise<NewMemoryInput[]> {
    if (messages.length === 0) return [];

    // Build a compact conversation transcript (last 30 messages max).
    const transcript = messages
      .slice(-30)
      .filter((m) => m.role !== 'system')
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `You are a memory extraction assistant for an AI operations hub.
Your job is to read a conversation and extract key information worth remembering long-term.

Extract memories for an AI agent of type: ${agentType}
Organization ID (for context only): ${orgId}

Return ONLY a valid JSON array of memory objects. Do not add any surrounding text.

Each memory object must have:
- content: string  (the memory text, concise and specific)
- type: "FACT" | "PREFERENCE" | "CONTEXT" | "DECISION" | "RELATIONSHIP"
- confidence: number  (0.0–1.0, your confidence this is worth remembering)
- tags: string[]  (lowercase descriptive tags, max 5)

Rules:
- Only extract genuinely useful, durable information.
- Ignore pleasantries, transient status updates, and one-off instructions.
- Prefer DECISION for resolved choices, FACT for objective information,
  PREFERENCE for user preferences, RELATIONSHIP for people/company connections,
  CONTEXT for background situational info.
- If nothing is worth remembering, return an empty array: []
- Maximum 10 memories per conversation.`;

    const userMessage = `Here is the conversation transcript:\n\n${transcript}\n\nExtract memories as a JSON array.`;

    let rawResponse: string;
    try {
      rawResponse = await completeWithClaude(
        [{ role: 'user', content: userMessage }],
        systemPrompt,
        { model: FAST_MODEL, maxTokens: 1024, temperature: 0.2 }
      );
    } catch (err) {
      console.error('[MemoryManager] Claude extraction failed:', err);
      return [];
    }

    // Extract the JSON array from the response (Claude may wrap in markdown).
    const jsonMatch =
      rawResponse.match(/```json\s*([\s\S]*?)```/i) ??
      rawResponse.match(/(\[[\s\S]*\])/);

    const jsonStr = jsonMatch ? jsonMatch[1] : rawResponse.trim();

    try {
      const parsed: unknown = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return [];

      const results: NewMemoryInput[] = [];

      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;

        const content = typeof obj.content === 'string' ? obj.content.trim() : '';
        if (!content) continue;

        const type = VALID_MEMORY_TYPES.includes(obj.type as MemoryType)
          ? (obj.type as MemoryType)
          : MemoryType.CONTEXT;

        const confidence =
          typeof obj.confidence === 'number'
            ? Math.min(1, Math.max(0, obj.confidence))
            : 0.8;

        const tags = Array.isArray(obj.tags)
          ? (obj.tags as unknown[])
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.toLowerCase().trim())
              .slice(0, 5)
          : [];

        results.push({
          content,
          type,
          confidence,
          tags,
          agentType: agentType as AgentType,
        });
      }

      return results.slice(0, 10);
    } catch (err) {
      console.error(
        '[MemoryManager] Failed to parse Claude extraction response:',
        err,
        '\nRaw response:',
        rawResponse
      );
      return [];
    }
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_MEMORY_TYPES: MemoryType[] = [
  MemoryType.FACT,
  MemoryType.PREFERENCE,
  MemoryType.CONTEXT,
  MemoryType.DECISION,
  MemoryType.RELATIONSHIP,
];

// ─── Singleton ────────────────────────────────────────────────────────────────

let _memoryManager: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!_memoryManager) _memoryManager = new MemoryManager();
  return _memoryManager;
}
