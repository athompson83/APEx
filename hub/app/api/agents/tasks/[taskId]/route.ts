/**
 * GET    /api/agents/tasks/[taskId]  — get task details
 * PATCH  /api/agents/tasks/[taskId]  — update task status/result
 * DELETE /api/agents/tasks/[taskId]  — delete task
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { TaskStatus } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { taskId: string } };

async function getTask(taskId: string, organizationId: string) {
  return db.agentTask.findFirst({
    where: { id: taskId, organizationId },
    include: {
      agent: { select: { id: true, name: true, type: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

// ---------------------------------------------------------------------------
// GET — task details
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const task = await getTask(params.taskId, org.id);
    if (!task) return apiError('Task not found', 404);

    return apiSuccess({ task });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/agents/tasks/[taskId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH — update task status/result
// ---------------------------------------------------------------------------

const patchTaskSchema = z.object({
  status: z.nativeEnum(TaskStatus).optional(),
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().max(5000).optional(),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await getTask(params.taskId, org.id);
    if (!existing) return apiError('Task not found', 404);

    const body = await req.json();
    const input = validateRequest(patchTaskSchema, body);

    const now = new Date();
    const updated = await db.agentTask.update({
      where: { id: params.taskId },
      data: {
        ...(input.status !== undefined && { status: input.status }),
        ...(input.result !== undefined && { result: input.result }),
        ...(input.errorMessage !== undefined && { errorMessage: input.errorMessage }),
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && { description: input.description }),
        // Set timestamps based on status transitions
        ...(input.status === TaskStatus.RUNNING && !existing.startedAt && { startedAt: now }),
        ...(
          (input.status === TaskStatus.COMPLETED || input.status === TaskStatus.FAILED) &&
          !existing.completedAt && { completedAt: now }
        ),
      },
    });

    return apiSuccess({ task: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[PATCH /api/agents/tasks/[taskId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete task
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await db.agentTask.findFirst({
      where: { id: params.taskId, organizationId: org.id },
    });
    if (!existing) return apiError('Task not found', 404);

    await db.agentTask.delete({ where: { id: params.taskId } });

    return apiSuccess({ message: 'Task deleted' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/agents/tasks/[taskId]]', err);
    return apiError('Internal server error', 500);
  }
}
