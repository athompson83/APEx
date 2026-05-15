// ============================================================
// APEx Hub – AI Agent System: Agent Orchestrator
// ============================================================

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentContext,
  AgentMessage,
  AgentMetadata,
  AgentResponse,
  Memory,
  RelevantDoc,
} from './types';
import { AgentType, AGENT_METADATA } from './types';
import { BaseAgent } from './base-agent';
import { ChiefOfStaffAgent } from './chief-of-staff';
import { OperationsManagerAgent } from './operations-manager';
import { SalesManagerAgent } from './sales-manager';
import { CustomerSuccessAgent } from './customer-success';
import { AccountingAgent } from './accounting';
import { LegalOpsAgent } from './legal-ops';
import { ProductManagerAgent } from './product-manager';

// ── Prisma (optional — gracefully degrades when DB is unavailable) ────────────

let _prisma: import('@prisma/client').PrismaClient | null = null;

async function getPrisma(): Promise<import('@prisma/client').PrismaClient | null> {
  if (_prisma) return _prisma;
  try {
    const { default: client } = await import('@/lib/db');
    _prisma = client;
    return _prisma;
  } catch {
    return null;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RECENT_MEMORY_LIMIT = 10;
const RECENT_DOC_LIMIT = 5;
const CONVERSATION_HISTORY_LIMIT = 20;

// ─────────────────────────────────────────────────────────────────────────────
// AgentOrchestrator
// ─────────────────────────────────────────────────────────────────────────────

export class AgentOrchestrator {
  private readonly anthropic: Anthropic;
  private readonly agents: Map<AgentType, BaseAgent>;

  constructor(anthropic?: Anthropic) {
    // Allow injecting a client (useful for testing) or create a singleton
    this.anthropic =
      anthropic ??
      new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

    this.agents = new Map<AgentType, BaseAgent>([
      [AgentType.CHIEF_OF_STAFF, new ChiefOfStaffAgent(this.anthropic)],
      [AgentType.OPERATIONS_MANAGER, new OperationsManagerAgent(this.anthropic)],
      [AgentType.SALES_MANAGER, new SalesManagerAgent(this.anthropic)],
      [AgentType.CUSTOMER_SUCCESS, new CustomerSuccessAgent(this.anthropic)],
      [AgentType.ACCOUNTING, new AccountingAgent(this.anthropic)],
      [AgentType.LEGAL_OPS, new LegalOpsAgent(this.anthropic)],
      [AgentType.PRODUCT_MANAGER, new ProductManagerAgent(this.anthropic)],
    ]);
  }

  // ── Agent access ────────────────────────────────────────────────────────────

  /**
   * Returns the agent instance for the given type.
   * Throws if the type is not registered (should never happen with the enum).
   */
  getAgent(type: AgentType): BaseAgent {
    const agent = this.agents.get(type);
    if (!agent) {
      throw new Error(`No agent registered for type: ${type}`);
    }
    return agent;
  }

  /**
   * Returns metadata for all registered agents — useful for building UI menus.
   */
  getAgentMetadata(): AgentMetadata[] {
    return Object.values(AGENT_METADATA);
  }

  // ── Single-agent routing ────────────────────────────────────────────────────

  /**
   * Route a message to a specific agent and return the response.
   * This is the primary entry point for single-agent chat interactions.
   */
  async routeMessage(
    message: string,
    agentType: AgentType,
    ctx: AgentContext,
  ): Promise<AgentResponse> {
    const agent = this.getAgent(agentType);

    try {
      return await agent.chat(message, ctx);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        content: `I encountered an error while processing your request: ${msg}\n\nPlease try again or contact support if the issue persists.`,
      };
    }
  }

  /**
   * Stream a message to a specific agent.
   * Returns the AsyncGenerator directly for SSE / streaming API routes.
   */
  streamMessage(
    message: string,
    agentType: AgentType,
    ctx: AgentContext,
  ) {
    const agent = this.getAgent(agentType);
    return agent.stream(message, ctx);
  }

  // ── Multi-agent queries ─────────────────────────────────────────────────────

  /**
   * Send the same message to multiple agents concurrently and collect all responses.
   * Useful for cross-functional analysis (e.g. "what are the biggest risks right now?").
   */
  async runMultiAgentQuery(
    message: string,
    agentTypes: AgentType[],
    ctx: AgentContext,
  ): Promise<Map<AgentType, AgentResponse>> {
    const results = new Map<AgentType, AgentResponse>();

    const promises = agentTypes.map(async (type) => {
      const agentCtx: AgentContext = { ...ctx, agentType: type };
      try {
        const response = await this.getAgent(type).chat(message, agentCtx);
        results.set(type, response);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        results.set(type, {
          content: `Error from ${AGENT_METADATA[type].name}: ${msg}`,
        });
      }
    });

    await Promise.all(promises);
    return results;
  }

  // ── Context building ────────────────────────────────────────────────────────

  /**
   * Assemble a full AgentContext for an agent call.
   *
   * 1. Fetches recent memories for the org + agent type
   * 2. Performs a best-effort semantic search for relevant documents
   * 3. Gets recent conversation history for the session
   * 4. Loads org settings
   */
  async buildContext(
    organizationId: string,
    userId: string,
    agentType: AgentType,
    conversationId?: string,
  ): Promise<AgentContext> {
    const [memories, documents, conversationHistory, orgSettings] =
      await Promise.all([
        this.fetchMemories(organizationId, agentType),
        this.fetchRelevantDocuments(organizationId),
        conversationId
          ? this.fetchConversationHistory(conversationId, organizationId)
          : Promise.resolve([] as AgentMessage[]),
        this.fetchOrgSettings(organizationId),
      ]);

    return {
      organizationId,
      userId,
      agentType,
      memories,
      documents,
      conversationHistory,
      orgSettings,
    };
  }

  // ── Private fetchers ────────────────────────────────────────────────────────

  private async fetchMemories(
    organizationId: string,
    agentType: AgentType,
  ): Promise<Memory[]> {
    try {
      const db = await getPrisma();
      if (!db) return [];

      const rows = await (db as unknown as {
        memory: {
          findMany: (args: unknown) => Promise<Array<{
            id: string;
            content: string;
            type: string;
            confidence: number;
            tags: string[];
            agentType: string | null;
          }>>;
        };
      }).memory.findMany({
        where: {
          organizationId,
          OR: [
            { agentType: agentType },
            { agentType: null }, // org-wide memories
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: RECENT_MEMORY_LIMIT,
        select: {
          id: true,
          content: true,
          type: true,
          confidence: true,
          tags: true,
          agentType: true,
        },
      });

      return rows.map((r) => ({
        id: r.id,
        content: r.content,
        type: r.type,
        confidence: r.confidence,
        tags: r.tags,
        agentType: r.agentType ?? undefined,
      }));
    } catch {
      return [];
    }
  }

  private async fetchRelevantDocuments(
    organizationId: string,
  ): Promise<RelevantDoc[]> {
    try {
      const db = await getPrisma();
      if (!db) return [];

      // Fetch the most recently updated documents as a fallback.
      // Production: replace with pgvector cosine similarity search.
      const rows = await (db as unknown as {
        document: {
          findMany: (args: unknown) => Promise<Array<{
            id: string;
            name: string;
            content: string;
          }>>;
        };
      }).document.findMany({
        where: { organizationId },
        orderBy: { updatedAt: 'desc' },
        take: RECENT_DOC_LIMIT,
        select: { id: true, name: true, content: true },
      });

      return rows.map((r, idx) => ({
        id: r.id,
        name: r.name,
        content: r.content.slice(0, 1500), // truncate to keep context manageable
        relevance: Math.max(0.5, 1 - idx * 0.1), // placeholder relevance scoring
      }));
    } catch {
      return [];
    }
  }

  private async fetchConversationHistory(
    conversationId: string,
    organizationId: string,
  ): Promise<AgentMessage[]> {
    try {
      const db = await getPrisma();
      if (!db) return [];

      const rows = await (db as unknown as {
        message: {
          findMany: (args: unknown) => Promise<Array<{
            id: string;
            role: string;
            content: string;
            createdAt: Date;
            metadata: unknown;
          }>>;
        };
      }).message.findMany({
        where: {
          conversationId,
          conversation: { organizationId },
        },
        orderBy: { createdAt: 'asc' },
        take: CONVERSATION_HISTORY_LIMIT,
        select: { id: true, role: true, content: true, createdAt: true, metadata: true },
      });

      return rows
        .filter((r) => r.role === 'user' || r.role === 'assistant')
        .map((r) => ({
          role: r.role as 'user' | 'assistant' | 'system',
          content: r.content,
          timestamp: r.createdAt,
          metadata: r.metadata as Record<string, unknown> | undefined,
        }));
    } catch {
      return [];
    }
  }

  private async fetchOrgSettings(
    organizationId: string,
  ): Promise<Record<string, unknown>> {
    try {
      const db = await getPrisma();
      if (!db) return {};

      const org = await (db as unknown as {
        organization: {
          findUnique: (args: unknown) => Promise<{
            id: string;
            name: string;
            settings: unknown;
          } | null>;
        };
      }).organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, settings: true },
      });

      if (!org) return {};

      return {
        organizationId: org.id,
        organizationName: org.name,
        ...(org.settings && typeof org.settings === 'object'
          ? (org.settings as Record<string, unknown>)
          : {}),
      };
    } catch {
      return {};
    }
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

let _orchestratorInstance: AgentOrchestrator | null = null;

/**
 * Returns a singleton AgentOrchestrator.
 * Suitable for use in Next.js API routes and server components.
 */
export function getOrchestrator(): AgentOrchestrator {
  if (!_orchestratorInstance) {
    _orchestratorInstance = new AgentOrchestrator();
  }
  return _orchestratorInstance;
}
