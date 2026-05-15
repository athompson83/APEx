/**
 * GET  /api/agents/tasks  — list tasks with filters (agentType, status, priority)
 * POST /api/agents/tasks  — create new task
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { AgentType, TaskStatus, TaskPriority } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
  paginationParams,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// GET — list tasks with optional filters
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);

    const agentTypeFilter = sp.get('agentType');
    const statusFilter = sp.get('status') as TaskStatus | null;
    const priorityFilter = sp.get('priority') as TaskPriority | null;

    // Resolve optional agentType filter to an agentId
    let agentIdFilter: string | undefined;
    if (agentTypeFilter) {
      const upper = agentTypeFilter.toUpperCase().replace(/-/g, '_');
      const agent = await db.agent.findFirst({
        where: { organizationId: org.id, type: upper as AgentType },
        select: { id: true },
      });
      if (agent) agentIdFilter = agent.id;
    }

    const where = {
      organizationId: org.id,
      ...(agentIdFilter && { agentId: agentIdFilter }),
      ...(statusFilter && { status: statusFilter }),
      ...(priorityFilter && { priority: priorityFilter }),
    };

    const [tasks, total] = await Promise.all([
      db.agentTask.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
        include: {
          agent: { select: { id: true, name: true, type: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      db.agentTask.count({ where }),
    ]);

    return apiSuccess({
      tasks,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/agents/tasks]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — create new task
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  agentType: z.nativeEnum(AgentType),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(createTaskSchema, body);

    const agent = await db.agent.findFirst({
      where: { organizationId: org.id, type: input.agentType, isActive: true },
    });
    if (!agent) return apiError(`No active agent of type ${input.agentType}`, 404);

    const task = await db.agentTask.create({
      data: {
        agentId: agent.id,
        organizationId: org.id,
        userId: session.user.id,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: TaskStatus.PENDING,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
      },
    });

    return apiSuccess({ task }, 201);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/agents/tasks]', err);
    return apiError('Internal server error', 500);
  }
}
