// ============================================================
// APEx Hub – AI Agent System: Tool Implementations
// ============================================================

import type { AgentContext, AgentTool } from './types';
import { AgentType } from './types';

// ── Prisma (optional — gracefully degrades when DB is unavailable) ─────────

let prisma: import('@prisma/client').PrismaClient | null = null;

async function getPrisma(): Promise<import('@prisma/client').PrismaClient | null> {
  if (prisma) return prisma;
  try {
    // Dynamic import so the module loads even without a DB connection
    const { default: client } = await import('@/lib/db');
    prisma = client;
    return prisma;
  } catch {
    return null;
  }
}

// ── Shared JSON response helper ───────────────────────────────────────────────

function ok<T>(data: T): { success: true; data: T } {
  return { success: true, data };
}

function err(message: string): { success: false; error: string } {
  return { success: false, error: message };
}

// ─────────────────────────────────────────────────────────────────────────────
// searchKnowledgeBase
// ─────────────────────────────────────────────────────────────────────────────

export async function searchKnowledgeBase(
  query: string,
  orgId: string,
): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({
        query,
        results: [],
        note: 'Database not available — returning empty result set.',
      });
    }

    // Fetch document chunks that belong to this org and do a naive text search.
    // Production: replace with pgvector cosine similarity.
    const rows = await (db as unknown as {
      documentChunk: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          content: string;
          document: { id: string; name: string };
        }>>;
      };
    }).documentChunk.findMany({
      where: {
        document: { organizationId: orgId },
        content: { contains: query, mode: 'insensitive' },
      },
      include: { document: { select: { id: true, name: true } } },
      take: 5,
    });

    const results = rows.map((r) => ({
      chunkId: r.id,
      documentId: r.document.id,
      documentName: r.document.name,
      excerpt: r.content.slice(0, 400),
    }));

    return ok({ query, results });
  } catch (e) {
    return err(`searchKnowledgeBase failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getBusinessMetrics
// ─────────────────────────────────────────────────────────────────────────────

export async function getBusinessMetrics(orgId: string): Promise<unknown> {
  try {
    const db = await getPrisma();

    // If we have real data, surface it; otherwise return the mock shape so the
    // agent always has something to reason about.
    if (!db) {
      return ok(getMockBusinessMetrics(orgId));
    }

    // Attempt to pull live data — fall back to mock on any error.
    try {
      const tasks = await (db as unknown as {
        task: {
          groupBy: (args: unknown) => Promise<Array<{ status: string; _count: { _all: number } }>>;
        };
      }).task.groupBy({
        by: ['status'],
        where: { organizationId: orgId },
        _count: { _all: true },
      });

      const taskBreakdown = Object.fromEntries(
        tasks.map((t) => [t.status, t._count._all]),
      );

      return ok({
        ...getMockBusinessMetrics(orgId),
        tasks: taskBreakdown,
        dataSource: 'live',
      });
    } catch {
      return ok(getMockBusinessMetrics(orgId));
    }
  } catch (e) {
    return err(`getBusinessMetrics failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function getMockBusinessMetrics(orgId: string) {
  return {
    orgId,
    dataSource: 'placeholder',
    period: 'current_month',
    revenue: {
      mrr: 0,
      arr: 0,
      mrrGrowthPercent: 0,
      churnRate: 0,
    },
    customers: {
      total: 0,
      active: 0,
      newThisMonth: 0,
      churned: 0,
    },
    pipeline: {
      totalValue: 0,
      dealCount: 0,
      weightedValue: 0,
    },
    tasks: {
      OPEN: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
    },
    runway: {
      months: null,
      cashBalance: null,
    },
    note: 'Connect your CRM, billing, and accounting integrations to see live data.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getTasksSummary
// ─────────────────────────────────────────────────────────────────────────────

export async function getTasksSummary(orgId: string): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({ orgId, tasks: [], note: 'Database not available.' });
    }

    const tasks = await (db as unknown as {
      task: {
        findMany: (args: unknown) => Promise<Array<{
          id: string;
          title: string;
          priority: string;
          status: string;
          agentType: string | null;
          scheduledFor: Date | null;
          createdAt: Date;
        }>>;
      };
    }).task.findMany({
      where: { organizationId: orgId, status: { not: 'COMPLETED' } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 20,
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        agentType: true,
        scheduledFor: true,
        createdAt: true,
      },
    });

    return ok({ orgId, tasks });
  } catch (e) {
    return err(`getTasksSummary failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getCustomerHealth
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomerHealth(orgId: string): Promise<unknown> {
  return ok({
    orgId,
    dataSource: 'placeholder',
    customers: [],
    summary: {
      healthy: 0,
      atRisk: 0,
      critical: 0,
    },
    note: 'Connect your CRM / customer success platform to see live health scores.',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getPipelineSummary
// ─────────────────────────────────────────────────────────────────────────────

export async function getPipelineSummary(orgId: string): Promise<unknown> {
  return ok({
    orgId,
    dataSource: 'placeholder',
    stages: [],
    totals: {
      deals: 0,
      totalValue: 0,
      weightedValue: 0,
      avgDealSize: 0,
    },
    note: 'Connect your CRM to see live pipeline data.',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// createTask
// ─────────────────────────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  description: string,
  agentType: AgentType,
  orgId: string,
  userId?: string,
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM',
  scheduledFor?: Date,
): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({
        created: false,
        task: { title, description, agentType, priority, scheduledFor },
        note: 'Database not available — task was not persisted.',
      });
    }

    const task = await (db as unknown as {
      task: {
        create: (args: unknown) => Promise<{
          id: string;
          title: string;
          description: string | null;
          priority: string;
          status: string;
          agentType: string | null;
          scheduledFor: Date | null;
          createdAt: Date;
        }>;
      };
    }).task.create({
      data: {
        title,
        description,
        priority,
        agentType,
        organizationId: orgId,
        ...(userId ? { createdById: userId } : {}),
        ...(scheduledFor ? { scheduledFor } : {}),
        status: 'OPEN',
      },
    });

    return ok({ created: true, task });
  } catch (e) {
    return err(`createTask failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeFinancials
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeFinancials(
  period: string,
  orgId: string,
): Promise<unknown> {
  return ok({
    orgId,
    period,
    dataSource: 'placeholder',
    income: {
      revenue: 0,
      recurringRevenue: 0,
      oneTimeRevenue: 0,
    },
    expenses: {
      total: 0,
      byCategory: {},
    },
    metrics: {
      grossMargin: null,
      netBurnRate: null,
      runwayMonths: null,
      ltv: null,
      cac: null,
      ltvCacRatio: null,
      paybackPeriodMonths: null,
    },
    note: 'Connect your accounting platform (QuickBooks, Xero, Stripe) to see live financial data.',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// createSop
// ─────────────────────────────────────────────────────────────────────────────

export async function createSop(
  title: string,
  description: string,
  steps: string[],
  category: string,
  orgId: string,
): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({
        created: false,
        sop: { title, description, steps, category },
        note: 'Database not available — SOP was not persisted.',
      });
    }

    const content = [
      `# ${title}`,
      '',
      description,
      '',
      '## Steps',
      ...steps.map((s, i) => `${i + 1}. ${s}`),
    ].join('\n');

    const doc = await (db as unknown as {
      document: {
        create: (args: unknown) => Promise<{ id: string; name: string; createdAt: Date }>;
      };
    }).document.create({
      data: {
        name: title,
        content,
        category: category || 'SOP',
        organizationId: orgId,
        metadata: JSON.stringify({ type: 'sop', steps: steps.length }),
      },
    });

    return ok({ created: true, document: doc });
  } catch (e) {
    return err(`createSop failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// getWorkflows
// ─────────────────────────────────────────────────────────────────────────────

export async function getWorkflows(orgId: string): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({ orgId, workflows: [], note: 'Database not available.' });
    }

    const docs = await (db as unknown as {
      document: {
        findMany: (args: unknown) => Promise<Array<{ id: string; name: string; content: string; createdAt: Date }>>;
      };
    }).document.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { category: 'SOP' },
          { category: 'WORKFLOW' },
          { name: { contains: 'workflow', mode: 'insensitive' } },
          { name: { contains: 'process', mode: 'insensitive' } },
          { name: { contains: 'sop', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return ok({ orgId, workflows: docs });
  } catch (e) {
    return err(`getWorkflows failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createChecklist
// ─────────────────────────────────────────────────────────────────────────────

export async function createChecklist(
  title: string,
  items: string[],
  category: string,
  orgId: string,
): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({
        created: false,
        checklist: { title, items, category },
        content: formatChecklistMarkdown(title, items),
        note: 'Database not available — checklist was not persisted.',
      });
    }

    const content = formatChecklistMarkdown(title, items);

    const doc = await (db as unknown as {
      document: {
        create: (args: unknown) => Promise<{ id: string; name: string; createdAt: Date }>;
      };
    }).document.create({
      data: {
        name: title,
        content,
        category: category || 'CHECKLIST',
        organizationId: orgId,
        metadata: JSON.stringify({ type: 'checklist', itemCount: items.length }),
      },
    });

    return ok({ created: true, document: doc, content });
  } catch (e) {
    return err(`createChecklist failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function formatChecklistMarkdown(title: string, items: string[]): string {
  return [`# ${title}`, '', ...items.map((item) => `- [ ] ${item}`)].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzePipeline
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzePipeline(
  orgId: string,
  filters?: { stage?: string; minValue?: number },
): Promise<unknown> {
  return ok({
    orgId,
    filters,
    dataSource: 'placeholder',
    deals: [],
    analysis: {
      conversionRates: {},
      avgCycleLength: null,
      topStuckDeals: [],
      forecastThisQuarter: 0,
      keyInsights: [
        'Connect your CRM (HubSpot, Salesforce, Pipedrive) to unlock live pipeline analysis.',
      ],
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// draftOutreach
// ─────────────────────────────────────────────────────────────────────────────

export async function draftOutreach(
  prospectInfo: {
    name?: string;
    company?: string;
    title?: string;
    painPoints?: string[];
    industry?: string;
  },
  type: 'cold_email' | 'follow_up' | 'linkedin' | 'proposal',
): Promise<unknown> {
  const { name = 'there', company = 'your organization', title = '', industry = '' } = prospectInfo;
  const painPoints = prospectInfo.painPoints ?? [];

  const painLine =
    painPoints.length > 0
      ? `We've helped similar ${industry || 'organizations'} solve challenges around ${painPoints.slice(0, 2).join(' and ')}.`
      : `We've helped similar organizations in your space drive measurable operational improvements.`;

  const drafts: Record<string, string> = {
    cold_email: [
      `Subject: Quick question about ${company}'s operations, ${name}`,
      '',
      `Hi ${name},`,
      '',
      `I noticed ${company} ${title ? `(and your role as ${title})` : ''} and wanted to reach out directly.`,
      '',
      painLine,
      '',
      'APEx helps healthcare and public safety organizations streamline operations with AI — without adding headcount.',
      '',
      'Would a 15-minute call make sense this week? Happy to share a relevant case study first.',
      '',
      'Best,',
      '[Your name]',
    ].join('\n'),

    follow_up: [
      `Subject: Re: APEx for ${company}`,
      '',
      `Hi ${name},`,
      '',
      'Wanted to follow up on my previous note — just making sure it didn\'t get buried.',
      '',
      painLine,
      '',
      'If timing isn\'t right, no worries at all — just let me know and I\'ll check back in next quarter.',
      '',
      'Best,',
      '[Your name]',
    ].join('\n'),

    linkedin: [
      `Hi ${name}, I came across your profile and was impressed by ${company}'s work in ${industry || 'the healthcare space'}.`,
      '',
      painLine,
      '',
      'I\'d love to share how we\'ve helped similar teams — open to a quick connect?',
    ].join('\n'),

    proposal: [
      `# Proposal for ${company}`,
      '',
      `## Overview`,
      `This proposal outlines how APEx can help ${company} ${title ? `(attn: ${name}, ${title})` : `(attn: ${name})`} achieve its operational goals.`,
      '',
      '## Challenge',
      painPoints.length > 0
        ? painPoints.map((p) => `- ${p}`).join('\n')
        : '- [To be completed based on discovery call]',
      '',
      '## Proposed Solution',
      '- AI-powered operations hub tailored to your workflows',
      '- Automated SOP management and process documentation',
      '- Real-time business intelligence and alerts',
      '',
      '## Investment',
      '[To be discussed]',
      '',
      '## Next Steps',
      '1. Discovery call to confirm requirements',
      '2. Technical scoping session',
      '3. Proposal finalization and contract',
    ].join('\n'),
  };

  const draft = drafts[type] ?? drafts.cold_email;
  return ok({ type, draft, prospectInfo });
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeCustomerHealth
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeCustomerHealth(
  orgId: string,
  customerId?: string,
): Promise<unknown> {
  return ok({
    orgId,
    customerId,
    dataSource: 'placeholder',
    customers: [],
    riskSummary: {
      critical: 0,
      atRisk: 0,
      healthy: 0,
    },
    note: 'Connect your customer success platform to see live health data.',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// reviewDocument
// ─────────────────────────────────────────────────────────────────────────────

export async function reviewDocument(
  documentId: string,
  orgId: string,
  focusAreas?: string[],
): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return err('Database not available — cannot retrieve document for review.');
    }

    const doc = await (db as unknown as {
      document: {
        findFirst: (args: unknown) => Promise<{
          id: string;
          name: string;
          content: string;
        } | null>;
      };
    }).document.findFirst({
      where: { id: documentId, organizationId: orgId },
      select: { id: true, name: true, content: true },
    });

    if (!doc) {
      return err(`Document ${documentId} not found.`);
    }

    return ok({
      documentId: doc.id,
      documentName: doc.name,
      contentLength: doc.content.length,
      excerpt: doc.content.slice(0, 1000),
      focusAreas: focusAreas ?? ['key clauses', 'risk areas', 'renewal dates', 'obligations'],
      note: 'Document retrieved. Use the excerpt and your legal knowledge to perform analysis.',
    });
  } catch (e) {
    return err(`reviewDocument failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// analyzeFeedback
// ─────────────────────────────────────────────────────────────────────────────

export async function analyzeFeedback(
  orgId: string,
  period?: string,
  featureArea?: string,
): Promise<unknown> {
  try {
    const db = await getPrisma();
    if (!db) {
      return ok({
        orgId,
        period,
        featureArea,
        feedback: [],
        themes: [],
        note: 'Database not available.',
      });
    }

    // Search for feedback documents
    const docs = await (db as unknown as {
      document: {
        findMany: (args: unknown) => Promise<Array<{ id: string; name: string; content: string }>>;
      };
    }).document.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { category: 'FEEDBACK' },
          { name: { contains: 'feedback', mode: 'insensitive' } },
          { name: { contains: 'bug', mode: 'insensitive' } },
          { name: { contains: 'feature request', mode: 'insensitive' } },
          ...(featureArea
            ? [{ content: { contains: featureArea, mode: 'insensitive' as const } }]
            : []),
        ],
      },
      select: { id: true, name: true, content: true },
      take: 10,
    });

    return ok({
      orgId,
      period,
      featureArea,
      feedbackDocuments: docs.map((d) => ({
        id: d.id,
        name: d.name,
        excerpt: d.content.slice(0, 300),
      })),
      note: 'Feedback documents retrieved for analysis.',
    });
  } catch (e) {
    return err(`analyzeFeedback failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool factory helpers — build AgentTool objects for each agent
// ─────────────────────────────────────────────────────────────────────────────

export function makeSearchKnowledgeBaseTool(): AgentTool {
  return {
    name: 'search_knowledge_base',
    description:
      'Search the organization\'s knowledge base (documents, SOPs, policies, notes) for information relevant to the query.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query.' },
      },
      required: ['query'],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return searchKnowledgeBase(params.query as string, ctx.organizationId);
    },
  };
}

export function makeGetBusinessMetricsTool(): AgentTool {
  return {
    name: 'get_business_metrics',
    description:
      'Retrieve key business metrics including MRR, customer count, pipeline value, and task status.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params: Record<string, unknown>, ctx: AgentContext) {
      return getBusinessMetrics(ctx.organizationId);
    },
  };
}

export function makeGetTasksSummaryTool(): AgentTool {
  return {
    name: 'get_tasks_summary',
    description: 'Get a summary of open and in-progress tasks across all agents.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params: Record<string, unknown>, ctx: AgentContext) {
      return getTasksSummary(ctx.organizationId);
    },
  };
}

export function makeGetCustomerHealthTool(): AgentTool {
  return {
    name: 'get_customer_health',
    description:
      'Retrieve customer health scores, churn risk indicators, and engagement metrics.',
    parameters: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'Optional: filter to a specific customer ID.',
        },
      },
      required: [],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return getCustomerHealth(ctx.organizationId);
    },
  };
}

export function makeGetPipelineSummaryTool(): AgentTool {
  return {
    name: 'get_pipeline_summary',
    description: 'Retrieve the current sales pipeline, deal stages, and forecast.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params: Record<string, unknown>, ctx: AgentContext) {
      return getPipelineSummary(ctx.organizationId);
    },
  };
}

export function makeCreateTaskTool(): AgentTool {
  return {
    name: 'create_task',
    description:
      'Create a new task and persist it to the database. Use this to capture action items surfaced during analysis.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title.' },
        description: { type: 'string', description: 'Detailed task description.' },
        agentType: {
          type: 'string',
          enum: Object.values(AgentType),
          description: 'Which agent domain owns this task.',
        },
        priority: {
          type: 'string',
          enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
          description: 'Task priority.',
        },
        scheduledFor: {
          type: 'string',
          format: 'date-time',
          description: 'Optional ISO-8601 date when this task should be completed.',
        },
      },
      required: ['title', 'description', 'agentType'],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      const scheduledFor = params.scheduledFor
        ? new Date(params.scheduledFor as string)
        : undefined;
      return createTask(
        params.title as string,
        params.description as string,
        params.agentType as AgentType,
        ctx.organizationId,
        ctx.userId,
        (params.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') ?? 'MEDIUM',
        scheduledFor,
      );
    },
  };
}

export function makeCreateSopTool(): AgentTool {
  return {
    name: 'create_sop',
    description:
      'Create and save a Standard Operating Procedure (SOP) document to the knowledge base.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'SOP title.' },
        description: { type: 'string', description: 'Purpose and scope of this SOP.' },
        steps: {
          type: 'array',
          items: { type: 'string' },
          description: 'Ordered list of steps.',
        },
        category: {
          type: 'string',
          description: 'Category such as "Onboarding", "Customer Success", "Engineering".',
        },
      },
      required: ['title', 'description', 'steps'],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return createSop(
        params.title as string,
        params.description as string,
        params.steps as string[],
        (params.category as string) ?? 'General',
        ctx.organizationId,
      );
    },
  };
}

export function makeGetWorkflowsTool(): AgentTool {
  return {
    name: 'get_workflows',
    description: 'Retrieve existing SOPs, workflows, and process documents from the knowledge base.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params: Record<string, unknown>, ctx: AgentContext) {
      return getWorkflows(ctx.organizationId);
    },
  };
}

export function makeCreateChecklistTool(): AgentTool {
  return {
    name: 'create_checklist',
    description:
      'Create an implementation or onboarding checklist and save it to the knowledge base.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Checklist title.' },
        items: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of checklist items.',
        },
        category: {
          type: 'string',
          description: 'Category such as "Onboarding", "Launch", "Compliance".',
        },
      },
      required: ['title', 'items'],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return createChecklist(
        params.title as string,
        params.items as string[],
        (params.category as string) ?? 'General',
        ctx.organizationId,
      );
    },
  };
}

export function makeAnalyzePipelineTool(): AgentTool {
  return {
    name: 'analyze_pipeline',
    description:
      'Analyze the sales pipeline for stage conversion rates, stuck deals, and quarterly forecast.',
    parameters: {
      type: 'object',
      properties: {
        stage: { type: 'string', description: 'Optional: filter to a specific pipeline stage.' },
        minValue: { type: 'number', description: 'Optional: minimum deal value filter.' },
      },
      required: [],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return analyzePipeline(ctx.organizationId, {
        stage: params.stage as string | undefined,
        minValue: params.minValue as number | undefined,
      });
    },
  };
}

export function makeDraftOutreachTool(): AgentTool {
  return {
    name: 'draft_outreach',
    description:
      'Draft a personalized outreach email, follow-up, LinkedIn message, or proposal for a prospect.',
    parameters: {
      type: 'object',
      properties: {
        prospectName: { type: 'string', description: 'Prospect first name or full name.' },
        company: { type: 'string', description: 'Prospect company name.' },
        title: { type: 'string', description: 'Prospect job title.' },
        industry: { type: 'string', description: 'Industry vertical.' },
        painPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Known pain points or challenges.',
        },
        type: {
          type: 'string',
          enum: ['cold_email', 'follow_up', 'linkedin', 'proposal'],
          description: 'Type of outreach to draft.',
        },
      },
      required: ['type'],
    },
    async execute(params: Record<string, unknown>, _ctx: AgentContext) {
      return draftOutreach(
        {
          name: params.prospectName as string,
          company: params.company as string,
          title: params.title as string,
          industry: params.industry as string,
          painPoints: params.painPoints as string[],
        },
        params.type as 'cold_email' | 'follow_up' | 'linkedin' | 'proposal',
      );
    },
  };
}

export function makeAnalyzeFinancialsTool(): AgentTool {
  return {
    name: 'analyze_financials',
    description:
      'Analyze financials for a given period: revenue, expenses, burn rate, runway, and SaaS metrics.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description:
            'Time period to analyze, e.g. "current_month", "last_quarter", "ytd", "2024-Q1".',
        },
      },
      required: ['period'],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return analyzeFinancials(params.period as string, ctx.organizationId);
    },
  };
}

export function makeAnalyzeCustomerHealthTool(): AgentTool {
  return {
    name: 'analyze_customer_health',
    description:
      'Analyze customer health, churn risk, engagement scores, and support ticket trends.',
    parameters: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'Optional: focus on a specific customer ID.',
        },
      },
      required: [],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return analyzeCustomerHealth(
        ctx.organizationId,
        params.customerId as string | undefined,
      );
    },
  };
}

export function makeReviewDocumentTool(): AgentTool {
  return {
    name: 'review_document',
    description:
      'Retrieve and prepare a document for legal review — surfacing key clauses, obligations, and risk areas.',
    parameters: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID to retrieve.' },
        focusAreas: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional focus areas, e.g. ["indemnification", "termination", "payment terms"].',
        },
      },
      required: ['documentId'],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return reviewDocument(
        params.documentId as string,
        ctx.organizationId,
        params.focusAreas as string[] | undefined,
      );
    },
  };
}

export function makeAnalyzeFeedbackTool(): AgentTool {
  return {
    name: 'analyze_feedback',
    description:
      'Analyze user feedback, bug reports, and feature requests to identify themes and prioritization signals.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          description: 'Time period to analyze, e.g. "last_30_days", "last_quarter".',
        },
        featureArea: {
          type: 'string',
          description: 'Optional: filter to a specific feature area or module.',
        },
      },
      required: [],
    },
    async execute(params: Record<string, unknown>, ctx: AgentContext) {
      return analyzeFeedback(
        ctx.organizationId,
        params.period as string | undefined,
        params.featureArea as string | undefined,
      );
    },
  };
}
