/**
 * POST /api/agents/[agentType]/chat
 *
 * Routes a message through the appropriate agent.
 * Supports streaming via ?stream=true (SSE).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { AgentType } from '@/lib/agents/types';
import { buildContext, routeMessage, streamMessage } from '@/lib/orchestrator';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const chatSchema = z.object({
  message: z.string().min(1).max(32_000),
  conversationId: z.string().cuid().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAgentType(raw: string): AgentType | null {
  const upper = raw.toUpperCase().replace(/-/g, '_');
  if (Object.values(AgentType).includes(upper as AgentType)) {
    return upper as AgentType;
  }
  return null;
}

async function resolveAgent(organizationId: string, agentType: AgentType) {
  return db.agent.findFirst({
    where: { organizationId, type: agentType, isActive: true },
  });
}

async function upsertConversation(opts: {
  conversationId?: string;
  agentId: string;
  organizationId: string;
  userId: string;
  agentType: AgentType;
}) {
  const { conversationId, agentId, organizationId, userId, agentType } = opts;

  if (conversationId) {
    const existing = await db.agentConversation.findFirst({
      where: { id: conversationId, organizationId },
    });
    if (!existing) throw apiError('Conversation not found', 404);
    return existing;
  }

  return db.agentConversation.create({
    data: {
      agentId,
      organizationId,
      userId,
      title: `${agentType.replace(/_/g, ' ')} Chat`,
      messages: [],
    },
  });
}

async function appendMessages(
  conversationId: string,
  userMessage: string,
  assistantContent: string,
) {
  const convo = await db.agentConversation.findUnique({
    where: { id: conversationId },
    select: { messages: true },
  });

  const existing = (convo?.messages ?? []) as Array<{ role: string; content: string; timestamp: string }>;
  const now = new Date().toISOString();

  await db.agentConversation.update({
    where: { id: conversationId },
    data: {
      messages: [
        ...existing,
        { role: 'user', content: userMessage, timestamp: now },
        { role: 'assistant', content: assistantContent, timestamp: now },
      ],
    },
  });
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  { params }: { params: { agentType: string } },
) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const agentType = parseAgentType(params.agentType);
    if (!agentType) return apiError(`Unknown agent type: ${params.agentType}`, 400);

    const body = await req.json();
    const input = validateRequest(chatSchema, body);

    const agent = await resolveAgent(org.id, agentType);
    if (!agent) return apiError(`Agent ${agentType} is not active for this organisation`, 404);

    const conversation = await upsertConversation({
      conversationId: input.conversationId,
      agentId: agent.id,
      organizationId: org.id,
      userId: session.user.id,
      agentType,
    });

    const context = await buildContext({
      organizationId: org.id,
      userId: session.user.id,
      agentType,
      conversationId: conversation.id,
      query: input.message,
    });

    // ── Streaming (SSE) ─────────────────────────────────────────────────────
    const wantsStream = req.nextUrl.searchParams.get('stream') === 'true';

    if (wantsStream) {
      const encoder = new TextEncoder();
      let fullContent = '';

      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamMessage(input.message, context)) {
              if (chunk.type === 'text') fullContent += chunk.content;
              const line = `data: ${JSON.stringify(chunk)}\n\n`;
              controller.enqueue(encoder.encode(line));
            }

            // Persist after stream completes
            await appendMessages(conversation.id, input.message, fullContent);

            // Send terminal event
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'done', content: '' })}\n\n`),
            );
            controller.close();
          } catch (streamErr) {
            const errLine = `data: ${JSON.stringify({ type: 'error', content: String(streamErr) })}\n\n`;
            controller.enqueue(encoder.encode(errLine));
            controller.close();
          }
        },
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Conversation-Id': conversation.id,
        },
      });
    }

    // ── Standard JSON response ───────────────────────────────────────────────
    const response = await routeMessage(input.message, context);

    await appendMessages(conversation.id, input.message, response.content);

    return apiSuccess({
      conversationId: conversation.id,
      response,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/agents/[agentType]/chat]', err);
    return apiError('Internal server error', 500);
  }
}
