/**
 * GET    /api/workflows/[workflowId]  — workflow details + recent runs
 * PATCH  /api/workflows/[workflowId]  — update workflow
 * DELETE /api/workflows/[workflowId]  — delete workflow
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { WorkflowStatus } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { workflowId: string } };

async function findWorkflow(workflowId: string, organizationId: string) {
  return db.workflow.findFirst({
    where: { id: workflowId, organizationId },
  });
}

// ---------------------------------------------------------------------------
// GET — workflow details + recent runs
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const workflow = await db.workflow.findFirst({
      where: { id: params.workflowId, organizationId: org.id },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            errorMessage: true,
          },
        },
        _count: { select: { runs: true } },
      },
    });

    if (!workflow) return apiError('Workflow not found', 404);

    return apiSuccess({ workflow });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/workflows/[workflowId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// PATCH — update workflow
// ---------------------------------------------------------------------------

const patchWorkflowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.nativeEnum(WorkflowStatus).optional(),
  trigger: z.record(z.unknown()).optional(),
  steps: z.array(z.record(z.unknown())).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await findWorkflow(params.workflowId, org.id);
    if (!existing) return apiError('Workflow not found', 404);

    const body = await req.json();
    const input = validateRequest(patchWorkflowSchema, body);

    const updated = await db.workflow.update({
      where: { id: params.workflowId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.trigger !== undefined && { trigger: input.trigger }),
        ...(input.steps !== undefined && { steps: input.steps }),
      },
    });

    return apiSuccess({ workflow: updated });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[PATCH /api/workflows/[workflowId]]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE — delete workflow
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const existing = await findWorkflow(params.workflowId, org.id);
    if (!existing) return apiError('Workflow not found', 404);

    await db.workflow.delete({ where: { id: params.workflowId } });

    return apiSuccess({ message: 'Workflow deleted' });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[DELETE /api/workflows/[workflowId]]', err);
    return apiError('Internal server error', 500);
  }
}
