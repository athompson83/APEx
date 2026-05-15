/**
 * GET  /api/agents/[agentType]/conversations  — list conversations (paginated)
 * POST /api/agents/[agentType]/conversations  — create new conversation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { AgentType, ConversationStatus } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
  paginationParams,
} from '@/lib/api/helpers';

function parseAgentType(raw: string): AgentType | null {
  const upper = raw.toUpperCase().replace(/-/g, '_');
  if (Object.values(AgentType).includes(upper as AgentType)) return upper as AgentType;
  return null;
}

// ---------------------------------------------------------------------------
// GET — list conversations for this agent type
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: { agentType: string } },
) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const agentType = parseAgentType(params.agentType);
    if (!agentType) return apiError(`Unknown agent type: ${params.agentType}`, 400);

    const agent = await db.agent.findFirst({
      where: { organizationId: org.id, type: agentType },
    });
    if (!agent) return apiError('Agent not found', 404);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);
    const statusFilter = sp.get('status') as ConversationStatus | null;

    const where = {
      agentId: agent.id,
      organizationId: org.id,
      userId: session.user.id,
      ...(statusFilter && { status: statusFilter }),
    };

    const [conversations, total] = await Promise.all([
      db.agentConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // Omit full messages array for list view — too large
        },
      }),
      db.agentConversation.count({ where }),
    ]);

    return apiSuccess({
      conversations,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/agents/[agentType]/conversations]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — create new conversation
// ---------------------------------------------------------------------------

const createConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { agentType: string } },
) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const agentType = parseAgentType(params.agentType);
    if (!agentType) return apiError(`Unknown agent type: ${params.agentType}`, 400);

    const agent = await db.agent.findFirst({
      where: { organizationId: org.id, type: agentType, isActive: true },
    });
    if (!agent) return apiError('Agent not found or not active', 404);

    const body = await req.json().catch(() => ({}));
    const input = validateRequest(createConversationSchema, body);

    const conversation = await db.agentConversation.create({
      data: {
        agentId: agent.id,
        organizationId: org.id,
        userId: session.user.id,
        title: input.title ?? `New ${agentType.replace(/_/g, ' ')} Conversation`,
        messages: [],
      },
    });

    return apiSuccess({ conversation }, 201);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/agents/[agentType]/conversations]', err);
    return apiError('Internal server error', 500);
  }
}
