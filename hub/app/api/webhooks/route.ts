/**
 * POST /api/webhooks
 *
 * Receives inbound webhooks from Zapier, Make, or custom integrations.
 * Validates the webhook secret, parses the payload, and routes to the
 * appropriate agent/workflow handler.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import db from '@/lib/db';
import { AgentType, WorkflowStatus, TaskStatus, TaskPriority } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api/helpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? '';

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) {
    // In development, skip signature check if no secret is set
    if (process.env.NODE_ENV === 'development') return true;
    return false;
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Timing-safe comparison
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature.replace('sha256=', ''), 'hex'),
      Buffer.from(expected, 'hex'),
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Payload schemas
// ---------------------------------------------------------------------------

const baseWebhookSchema = z.object({
  /** Identifies how to route this event */
  event: z.string().min(1).max(100),
  /** Source integration name (zapier, make, custom, etc.) */
  source: z.string().max(100).default('unknown'),
  organizationId: z.string().cuid(),
  payload: z.record(z.unknown()).default({}),
});

// ---------------------------------------------------------------------------
// Event routers
// ---------------------------------------------------------------------------

async function handleAgentMessage(
  event: string,
  organizationId: string,
  payload: Record<string, unknown>,
) {
  // event format: "agent.message.AGENT_TYPE"
  const agentTypePart = event.split('.')[2]?.toUpperCase();
  if (!agentTypePart || !Object.values(AgentType).includes(agentTypePart as AgentType)) {
    return { handled: false, reason: 'Unknown agent type in event' };
  }

  const agentType = agentTypePart as AgentType;
  const message = String(payload.message ?? '');
  if (!message) return { handled: false, reason: 'No message in payload' };

  // Lazily import to avoid circular dependency issues
  const { buildContext, routeMessage } = await import('@/lib/orchestrator');

  const agent = await db.agent.findFirst({
    where: { organizationId, type: agentType, isActive: true },
  });
  if (!agent) return { handled: false, reason: `No active agent of type ${agentType}` };

  // Find or use the org's system user as the actor
  const orgMember = await db.organizationMember.findFirst({
    where: { organizationId },
    orderBy: { createdAt: 'asc' },
  });
  if (!orgMember) return { handled: false, reason: 'No org member found' };

  const context = await buildContext({
    organizationId,
    userId: orgMember.userId,
    agentType,
    query: message,
  });

  const response = await routeMessage(message, context);

  return { handled: true, response };
}

async function handleWorkflowTrigger(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const workflowId = String(payload.workflowId ?? '');
  if (!workflowId) return { handled: false, reason: 'No workflowId in payload' };

  const workflow = await db.workflow.findFirst({
    where: { id: workflowId, organizationId, status: WorkflowStatus.ACTIVE },
  });
  if (!workflow) return { handled: false, reason: 'Workflow not found or not active' };

  const run = await db.workflowRun.create({
    data: {
      workflowId: workflow.id,
      organizationId,
      status: 'RUNNING',
      startedAt: new Date(),
      steps: [],
      output: { webhookInput: payload },
    },
  });

  await db.workflow.update({
    where: { id: workflow.id },
    data: { lastRunAt: new Date() },
  });

  return { handled: true, runId: run.id };
}

async function handleCreateTask(
  organizationId: string,
  payload: Record<string, unknown>,
) {
  const agentTypePart = String(payload.agentType ?? '').toUpperCase();
  if (!Object.values(AgentType).includes(agentTypePart as AgentType)) {
    return { handled: false, reason: 'Invalid agentType' };
  }

  const agent = await db.agent.findFirst({
    where: { organizationId, type: agentTypePart as AgentType, isActive: true },
  });
  if (!agent) return { handled: false, reason: 'No active agent found' };

  const task = await db.agentTask.create({
    data: {
      agentId: agent.id,
      organizationId,
      title: String(payload.title ?? 'Webhook-triggered task'),
      description: payload.description ? String(payload.description) : undefined,
      priority: (String(payload.priority ?? 'MEDIUM').toUpperCase() as TaskPriority) ?? TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
    },
  });

  return { handled: true, taskId: task.id };
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Validate signature if header present
    const signature = req.headers.get('x-hub-signature-256') ??
      req.headers.get('x-webhook-signature') ?? '';

    if (signature) {
      const valid = verifySignature(rawBody, signature, WEBHOOK_SECRET);
      if (!valid) return apiError('Invalid webhook signature', 401);
    } else if (WEBHOOK_SECRET && process.env.NODE_ENV !== 'development') {
      return apiError('Missing webhook signature', 401);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return apiError('Invalid JSON payload', 400);
    }

    const result = baseWebhookSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid webhook payload', issues: result.error.flatten().fieldErrors },
        { status: 422 },
      );
    }

    const { event, source, organizationId, payload } = result.data;

    // Verify the org exists
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!org) return apiError('Organisation not found', 404);

    // Audit the incoming webhook
    await db.auditLog.create({
      data: {
        organizationId,
        action: 'webhook.received',
        resource: 'webhook',
        details: { event, source },
        ipAddress: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? undefined,
      },
    });

    // ── Route by event type ──────────────────────────────────────────────────
    let handlerResult: Record<string, unknown> = {};

    if (event.startsWith('agent.message.')) {
      handlerResult = await handleAgentMessage(event, organizationId, payload);
    } else if (event === 'workflow.trigger') {
      handlerResult = await handleWorkflowTrigger(organizationId, payload);
    } else if (event === 'task.create') {
      handlerResult = await handleCreateTask(organizationId, payload);
    } else {
      // Unknown event — acknowledge receipt but do nothing
      handlerResult = { handled: false, reason: `Unrecognised event: ${event}` };
    }

    return apiSuccess({ received: true, event, ...handlerResult });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[POST /api/webhooks]', err);
    return apiError('Internal server error', 500);
  }
}
