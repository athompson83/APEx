/**
 * Workflow scheduler — polls for due workflows and enqueues them.
 *
 * Supported cron patterns (simple parser; no full cron library dependency):
 *   @daily       / 0 0 * * *      — once a day at midnight UTC
 *   @weekly      / 0 0 * * 0      — once a week on Sunday midnight UTC
 *   @monthly     / 0 0 1 * *      — first day of each month
 *   @hourly      / 0 * * * *      — every hour
 *   Every N minutes: * /N * * * * (e.g. "* /15 * * * *" → every 15 min)
 *
 * For production use with complex cron expressions, swap calculateNextRun()
 * for the `cron-parser` or `croner` package.
 */

import { PrismaClient, WorkflowStatus, WorkflowRunStatus } from '@prisma/client';
import { scheduleWorkflow } from '@/lib/queue/worker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkflowRun {
  id: string;
  workflowId: string;
  organizationId: string;
  status: WorkflowRunStatus;
  startedAt: Date;
  completedAt: Date | null;
  output: unknown;
  errorMessage: string | null;
  steps: unknown[];
}

// ─── Prisma singleton ─────────────────────────────────────────────────────────

let _prisma: PrismaClient | null = null;
function getPrisma(): PrismaClient {
  if (!_prisma) _prisma = new PrismaClient();
  return _prisma;
}

// ─── WorkflowScheduler ────────────────────────────────────────────────────────

export class WorkflowScheduler {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrisma();
  }

  // ─── scheduleRecurringWorkflows ──────────────────────────────────────────

  /**
   * Fetches all ACTIVE workflows whose `nextRunAt` is in the past (or not set),
   * enqueues each one, and updates `nextRunAt` based on the trigger cron.
   *
   * Safe to call repeatedly (e.g. every 60 seconds from a cron job or
   * setInterval); duplicate execution is prevented by the BullMQ jobId
   * derived from the workflowRunId.
   */
  async scheduleRecurringWorkflows(): Promise<void> {
    const now = new Date();

    const dueWorkflows = await this.prisma.workflow.findMany({
      where: {
        status: WorkflowStatus.ACTIVE,
        OR: [
          { nextRunAt: null },
          { nextRunAt: { lte: now } },
        ],
      },
    });

    if (dueWorkflows.length === 0) return;

    console.log(
      `[Scheduler] Found ${dueWorkflows.length} workflow(s) due for execution`
    );

    for (const workflow of dueWorkflows) {
      try {
        const trigger = workflow.trigger as Record<string, unknown>;
        const cronExpr = (trigger?.cron as string | undefined) ?? '';

        // Create a WorkflowRun and enqueue it.
        const run = await this.triggerWorkflow(workflow.id, workflow.organizationId);

        // Calculate and persist the next run time.
        const nextRunAt = cronExpr ? this.calculateNextRun(cronExpr) : null;

        await this.prisma.workflow.update({
          where: { id: workflow.id },
          data: { nextRunAt },
        });

        console.log(
          `[Scheduler] Enqueued workflow "${workflow.name}" (run: ${run.id}), ` +
            (nextRunAt ? `next run: ${nextRunAt.toISOString()}` : 'no recurring schedule')
        );
      } catch (err) {
        console.error(
          `[Scheduler] Failed to schedule workflow "${workflow.name}" (${workflow.id}):`,
          err
        );
      }
    }
  }

  // ─── calculateNextRun ────────────────────────────────────────────────────

  /**
   * Parses a subset of cron expressions and returns the next trigger Date.
   *
   * Supported shorthand:
   *   @hourly  @daily  @weekly  @monthly
   *
   * Supported standard patterns (5-part, space-separated):
   *   MIN HOUR DOM MON DOW
   *
   * Where each field is either `*` or a fixed integer.
   * Wildcard entries advance from "now".
   *
   * Returns a date 1 day in the future as a safe fallback for unparseable
   * expressions rather than throwing, to avoid breaking the scheduler loop.
   */
  calculateNextRun(cronExpression: string): Date {
    const expr = cronExpression.trim().toLowerCase();
    const now = new Date();

    // ── Shorthands ────────────────────────────────────────────────────────
    if (expr === '@hourly'  || expr === '0 * * * *')  return this.addHours(now, 1);
    if (expr === '@daily'   || expr === '0 0 * * *')  return this.nextMidnight(now);
    if (expr === '@weekly'  || expr === '0 0 * * 0')  return this.nextWeekly(now);
    if (expr === '@monthly' || expr === '0 0 1 * *')  return this.nextMonthly(now);

    // ── Every-N-minutes pattern: "*/N * * * *" ────────────────────────────
    const everyNMinutes = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/.exec(expr);
    if (everyNMinutes) {
      const n = parseInt(everyNMinutes[1], 10);
      if (!isNaN(n) && n > 0) {
        return new Date(now.getTime() + n * 60 * 1_000);
      }
    }

    // ── Every-N-hours pattern: "0 */N * * *" ────────────────────────────
    const everyNHours = /^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/.exec(expr);
    if (everyNHours) {
      const n = parseInt(everyNHours[1], 10);
      if (!isNaN(n) && n > 0) {
        return new Date(now.getTime() + n * 60 * 60 * 1_000);
      }
    }

    // ── Generic 5-field cron: MIN HOUR DOM MON DOW ────────────────────────
    const parts = expr.split(/\s+/);
    if (parts.length === 5) {
      const [minStr, hourStr, domStr, , dowStr] = parts;

      const minute = minStr  === '*' ? 0 : parseInt(minStr,  10);
      const hour   = hourStr === '*' ? 0 : parseInt(hourStr, 10);

      // If DOM or DOW are fixed, try to compute next occurrence.
      const next = new Date(now);
      next.setSeconds(0, 0);

      if (!isNaN(minute))  next.setMinutes(minute);
      if (!isNaN(hour))    next.setHours(hour);

      // Day-of-week override.
      if (dowStr !== '*') {
        const targetDow = parseInt(dowStr, 10);
        if (!isNaN(targetDow)) {
          const currentDow = next.getDay();
          const daysUntil = (targetDow - currentDow + 7) % 7 || 7;
          next.setDate(next.getDate() + daysUntil);
        }
      } else if (domStr !== '*') {
        const dom = parseInt(domStr, 10);
        if (!isNaN(dom)) {
          next.setDate(dom);
          // If that date is in the past this month, advance to next month.
          if (next <= now) {
            next.setMonth(next.getMonth() + 1);
            next.setDate(dom);
          }
        }
      } else {
        // Fully wildcarded days: advance to next day.
        if (next <= now) next.setDate(next.getDate() + 1);
      }

      if (next > now) return next;
    }

    // ── Safe fallback: 1 day from now ─────────────────────────────────────
    console.warn(
      `[Scheduler] Unrecognised cron expression "${cronExpression}", ` +
        'defaulting to 24 hours.'
    );
    return this.addHours(now, 24);
  }

  // ─── triggerWorkflow ─────────────────────────────────────────────────────

  /**
   * Creates a WorkflowRun record and enqueues it for execution.
   * Also updates the workflow's `lastRunAt` to the current time.
   *
   * @param workflowId    Workflow to run.
   * @param orgId         Organisation that owns the workflow.
   * @returns             The created WorkflowRun.
   */
  async triggerWorkflow(workflowId: string, orgId: string): Promise<WorkflowRun> {
    const now = new Date();

    // Validate the workflow exists and belongs to the org.
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, organizationId: orgId },
    });

    if (!workflow) {
      throw new Error(
        `Workflow ${workflowId} not found or does not belong to organisation ${orgId}`
      );
    }

    // Create the run record.
    const run = await this.prisma.workflowRun.create({
      data: {
        workflowId,
        organizationId: orgId,
        status: WorkflowRunStatus.RUNNING,
        startedAt: now,
        steps: [],
      },
    });

    // Update lastRunAt on the workflow.
    await this.prisma.workflow.update({
      where: { id: workflowId },
      data: { lastRunAt: now },
    });

    // Enqueue via BullMQ.
    await scheduleWorkflow({
      workflowRunId: run.id,
      workflowId,
      organizationId: orgId,
      stepIndex: 0,
    });

    return {
      id: run.id,
      workflowId: run.workflowId,
      organizationId: run.organizationId,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      output: run.output,
      errorMessage: run.errorMessage,
      steps: run.steps,
    };
  }

  // ─── Date helpers ────────────────────────────────────────────────────────

  private addHours(from: Date, hours: number): Date {
    return new Date(from.getTime() + hours * 60 * 60 * 1_000);
  }

  private nextMidnight(from: Date): Date {
    const next = new Date(from);
    next.setUTCHours(0, 0, 0, 0);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  private nextWeekly(from: Date): Date {
    const next = new Date(from);
    const daysUntilSunday = (7 - next.getUTCDay()) % 7 || 7;
    next.setUTCDate(next.getUTCDate() + daysUntilSunday);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }

  private nextMonthly(from: Date): Date {
    const next = new Date(from);
    // First day of next month, midnight UTC.
    next.setUTCMonth(next.getUTCMonth() + 1, 1);
    next.setUTCHours(0, 0, 0, 0);
    return next;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _scheduler: WorkflowScheduler | null = null;

export function getWorkflowScheduler(): WorkflowScheduler {
  if (!_scheduler) _scheduler = new WorkflowScheduler();
  return _scheduler;
}

// ─── Polling loop helper ──────────────────────────────────────────────────────

/**
 * Starts a polling loop that checks for due workflows every `intervalMs`
 * milliseconds (default: 60 seconds).
 *
 * Returns a cleanup function that stops the interval.
 */
export function startSchedulerPolling(intervalMs = 60_000): () => void {
  console.log(
    `[Scheduler] Starting polling loop (interval: ${intervalMs / 1_000}s)`
  );

  const scheduler = getWorkflowScheduler();

  // Run immediately on start.
  void scheduler.scheduleRecurringWorkflows().catch((err: unknown) => {
    console.error('[Scheduler] Initial poll failed:', err);
  });

  const timer = setInterval(() => {
    void scheduler.scheduleRecurringWorkflows().catch((err: unknown) => {
      console.error('[Scheduler] Poll failed:', err);
    });
  }, intervalMs);

  return () => {
    clearInterval(timer);
    console.log('[Scheduler] Polling loop stopped.');
  };
}
