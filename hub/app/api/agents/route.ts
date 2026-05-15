/**
 * GET  /api/agents       — list all agents for the org with metadata
 * POST /api/agents       — update agent settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';
import { AGENT_METADATA } from '@/lib/agents/types';

// ---------------------------------------------------------------------------
// GET — list agents for the org
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const agents = await db.agent.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
    });

    // Merge DB records with static metadata
    const enriched = agents.map((agent) => ({
      ...agent,
      metadata: AGENT_METADATA[agent.type] ?? null,
    }));

    return apiSuccess({ agents: enriched });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/agents]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — update agent settings
// ---------------------------------------------------------------------------

const updateAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).optional(),
  systemPrompt: z.string().max(8000).optional(),
  isActive: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(updateAgentSchema, body);

    // Ensure the agent belongs to this org
    const existing = await db.agent.findFirst({
      where: { id: input.agentId, organizationId: org.id },
    });
    if (!existing) return apiError('Agent not found', 404);

    const updated = await db.agent.update({
      where: { id: input.agentId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.settings !== undefined && { settings: input.settings }),
      },
    });

    return apiSuccess({ agent: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/agents]', err);
    return apiError('Internal server error', 500);
  }
}
