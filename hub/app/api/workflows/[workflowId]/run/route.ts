/**
 * POST /api/workflows/[workflowId]/run
 *
 * Manually trigger a workflow run.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import db from '@/lib/db';
import { WorkflowStatus, WorkflowRunStatus } from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  validateRequest,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

type Params = { params: { workflowId: string } };

const runWorkflowSchema = z.object({
  /** Optional override input passed to the first step */
  input: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const workflow = await db.workflow.findFirst({
      where: { id: params.workflowId, organizationId: org.id },
    });

    if (!workflow) return apiError('Workflow not found', 404);
    if (workflow.status === WorkflowStatus.PAUSED) {
      return apiError('Workflow is paused and cannot be run', 409);
    }

    const body = await req.json().catch(() => ({}));
    const input = validateRequest(runWorkflowSchema, body);

    // Create the WorkflowRun record
    const run = await db.workflowRun.create({
      data: {
        workflowId: workflow.id,
        organizationId: org.id,
        status: WorkflowRunStatus.RUNNING,
        startedAt: new Date(),
        steps: [],
        output: input.input ? { input: input.input } : {},
      },
    });

    // Update workflow lastRunAt
    await db.workflow.update({
      where: { id: workflow.id },
      data: { lastRunAt: new Date() },
    });

    // TODO: Dispatch actual workflow execution via BullMQ / queue
    // await workflowQueue.add('execute', { runId: run.id, workflowId: workflow.id });

    return apiSuccess({ run }, 202);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/workflows/[workflowId]/run]', err);
    return apiError('Internal server error', 500);
  }
}
