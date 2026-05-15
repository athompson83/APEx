/**
 * GET /api/dashboard
 *
 * Executive dashboard data — aggregates across agents, tasks, conversations,
 * documents, memories, and workflows in a single round-trip.
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import {
  AgentType,
  TaskStatus,
  WorkflowStatus,
  ConversationStatus,
  DocumentStatus,
} from '@/lib/db';
import {
  getAuthSession,
  getUserOrg,
  apiError,
  apiSuccess,
} from '@/lib/api/helpers';

export async function GET(_req: NextRequest) {
  try {
    const session = await getAuthSession();
    const org = await getUserOrg(session.user.id);
    const orgId = org.id;

    // Run all aggregation queries in parallel for performance
    const [
      // Task counts grouped by agent type and status
      taskGroups,

      // Recent conversations
      recentConversations,

      // Document count by status
      documentCounts,

      // Memory count
      memoryCount,

      // Workflow summary
      workflowCounts,

      // Active workflow count
      activeWorkflowCount,

      // Recent activity — latest 10 audit log entries
      recentActivity,

      // Running tasks right now
      runningTaskCount,
    ] = await Promise.all([
      // Task counts per agent type
      db.agentTask.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),

      // Recent conversations (last 5)
      db.agentConversation.findMany({
        where: { organizationId: orgId, status: ConversationStatus.ACTIVE },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          updatedAt: true,
          agent: { select: { name: true, type: true } },
          user: { select: { name: true, email: true } },
        },
      }),

      // Document counts by status
      db.document.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),

      // Memory count
      db.memory.count({
        where: {
          organizationId: orgId,
          approved: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      }),

      // Workflow counts by status
      db.workflow.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: { _all: true },
      }),

      // Active workflows
      db.workflow.count({
        where: { organizationId: orgId, status: WorkflowStatus.ACTIVE },
      }),

      // Recent audit log entries
      db.auditLog.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          resource: true,
          resourceId: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),

      // Running tasks
      db.agentTask.count({
        where: { organizationId: orgId, status: TaskStatus.RUNNING },
      }),
    ]);

    // Reshape task groups into a friendlier map
    const agentTaskCounts: Record<string, number> = {};
    for (const row of taskGroups) {
      agentTaskCounts[row.status] = row._count._all;
    }

    const docCountMap: Record<string, number> = {};
    for (const row of documentCounts) {
      docCountMap[row.status] = row._count._all;
    }

    const wfCountMap: Record<string, number> = {};
    for (const row of workflowCounts) {
      wfCountMap[row.status] = row._count._all;
    }

    return apiSuccess({
      organization: { id: org.id, name: org.name, plan: org.plan },
      agentTaskCounts,
      runningTaskCount,
      recentConversations,
      documentCount: Object.values(docCountMap).reduce((a, b) => a + b, 0),
      documentsByStatus: docCountMap,
      memoryCount,
      workflowCount: Object.values(wfCountMap).reduce((a, b) => a + b, 0),
      workflowsByStatus: wfCountMap,
      activeWorkflows: activeWorkflowCount,
      recentActivity,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error('[GET /api/dashboard]', err);
    return apiError('Internal server error', 500);
  }
}
