/**
 * GET  /api/workflows  — list workflows
 * POST /api/workflows  — create workflow
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
  paginationParams,
} from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// GET — list workflows
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const sp = req.nextUrl.searchParams;
    const { page, limit, skip } = paginationParams(sp);
    const statusFilter = sp.get('status') as WorkflowStatus | null;

    const where = {
      organizationId: org.id,
      ...(statusFilter && { status: statusFilter }),
    };

    const [workflows, total] = await Promise.all([
      db.workflow.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { runs: true } },
        },
      }),
      db.workflow.count({ where }),
    ]);

    return apiSuccess({
      workflows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/workflows]', err);
    return apiError('Internal server error', 500);
  }
}

// ---------------------------------------------------------------------------
// POST — create workflow
// ---------------------------------------------------------------------------

const triggerSchema = z.object({
  type: z.enum(['manual', 'schedule', 'webhook', 'event']),
  config: z.record(z.unknown()).default({}),
});

const stepSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  config: z.record(z.unknown()).default({}),
  nextStepId: z.string().optional(),
});

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  trigger: triggerSchema,
  steps: z.array(stepSchema).min(1),
  status: z.nativeEnum(WorkflowStatus).default(WorkflowStatus.DRAFT),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);

    const body = await req.json();
    const input = validateRequest(createWorkflowSchema, body);

    const workflow = await db.workflow.create({
      data: {
        organizationId: org.id,
        name: input.name,
        description: input.description,
        trigger: input.trigger,
        steps: input.steps,
        status: input.status,
      },
    });

    return apiSuccess({ workflow }, 201);
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/workflows]', err);
    return apiError('Internal server error', 500);
  }
}
