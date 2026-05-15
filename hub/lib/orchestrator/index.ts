/**
 * Agent Orchestrator
 *
 * Responsible for:
 *  1. Building the AgentContext for a request (memories + relevant docs + history)
 *  2. Routing a message to the correct agent implementation
 *  3. Persisting new memories suggested by the agent
 */

import type { AgentContext, AgentResponse } from '@/lib/agents/types';
import { AgentType } from '@/lib/agents/types';
import db from '@/lib/db';
import { getAnthropicClient } from '@/lib/ai/anthropic';
import { BaseAgent } from '@/lib/agents/base-agent';
import Anthropic from '@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// Minimal concrete agent (used when a specialist is not yet registered)
// ---------------------------------------------------------------------------

class GenericAgent extends BaseAgent {
  private readonly _name: string;

  constructor(agentType: AgentType, anthropic: Anthropic) {
    super(agentType, anthropic);
    this._name = agentType
      .split('_')
      .map((w) => w[0] + w.slice(1).toLowerCase())
      .join(' ');
  }

  getSystemPrompt(ctx: AgentContext): string {
    return (
      `You are the ${this._name} AI agent for organisation ${ctx.organizationId}. ` +
      `You are precise, professional, and always focus on operational outcomes. ` +
      `When you suggest tasks, output them in a JSON block under the key "tasks". ` +
      `When you learn something worth remembering, output it under the key "memories".`
    );
  }

  getTools() {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Agent registry — swap in specialist implementations as they are built
// ---------------------------------------------------------------------------

const agentRegistry = new Map<AgentType, (anthropic: Anthropic) => BaseAgent>();

function getAgent(type: AgentType): BaseAgent {
  const anthropic = getAnthropicClient();
  const factory = agentRegistry.get(type);
  if (factory) return factory(anthropic);
  return new GenericAgent(type, anthropic);
}

// ---------------------------------------------------------------------------
// Context builder
// ---------------------------------------------------------------------------

export interface BuildContextOptions {
  organizationId: string;
  userId: string;
  agentType: AgentType;
  conversationId?: string;
  /** The user message — used to score relevant memories/docs */
  query: string;
  /** Max memories to inject (default 10) */
  memoryLimit?: number;
  /** Max document chunks to inject (default 5) */
  docLimit?: number;
}

export async function buildContext(opts: BuildContextOptions): Promise<AgentContext> {
  const {
    organizationId,
    userId,
    agentType,
    conversationId,
    memoryLimit = 10,
  } = opts;

  // ── Memories ──────────────────────────────────────────────────────────────
  const rawMemories = await db.memory.findMany({
    where: {
      organizationId,
      approved: true,
      OR: [{ agentType: agentType }, { agentType: null }],
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    take: memoryLimit,
  });

  const memories = rawMemories.map((m) => ({
    id: m.id,
    content: m.content,
    type: m.type,
    confidence: Number(m.confidence),
    tags: m.tags,
    agentType: m.agentType ?? undefined,
  }));

  // ── Conversation history ──────────────────────────────────────────────────
  let conversationHistory: AgentContext['conversationHistory'] = [];

  if (conversationId) {
    const convo = await db.agentConversation.findUnique({
      where: { id: conversationId },
      select: { messages: true },
    });

    if (convo?.messages) {
      conversationHistory = (
        convo.messages as Array<{ role: string; content: string; timestamp: string }>
      ).map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: new Date(m.timestamp),
      }));
    }
  }

  // ── Org settings ──────────────────────────────────────────────────────────
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  return {
    organizationId,
    userId,
    agentType,
    memories,
    documents: [], // populated by semantic search when embeddings are available
    conversationHistory,
    orgSettings: (org?.settings as Record<string, unknown>) ?? {},
  };
}

// ---------------------------------------------------------------------------
// Route message through the appropriate agent
// ---------------------------------------------------------------------------

export async function routeMessage(
  message: string,
  context: AgentContext,
): Promise<AgentResponse> {
  const agent = getAgent(context.agentType);
  const response = await agent.chat(message, context);

  // Persist any new memories the agent suggested
  if (response.memories && response.memories.length > 0) {
    await Promise.all(
      response.memories.map((mem) =>
        db.memory.create({
          data: {
            organizationId: context.organizationId,
            agentType: context.agentType,
            content: mem.content,
            type: mem.type as import('@/lib/db').MemoryType,
            confidence: mem.confidence,
            tags: mem.tags,
            approved: false, // require human approval by default
          },
        }),
      ),
    );
  }

  return response;
}

// ---------------------------------------------------------------------------
// Streaming variant
// ---------------------------------------------------------------------------

export async function* streamMessage(
  message: string,
  context: AgentContext,
): AsyncGenerator<import('@/lib/agents/types').StreamChunk> {
  const agent = getAgent(context.agentType);
  yield* agent.stream(message, context);
}
