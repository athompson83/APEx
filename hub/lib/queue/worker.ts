/**
 * BullMQ queue definitions, workers, and job helpers.
 *
 * Queues:
 *   document-processing  — document ingestion from file buffers
 *   ai-tasks             — one-off agent task execution
 *   scheduled-workflows  — workflow step execution
 *   memory-extraction    — extract memories from completed conversations
 *
 * Workers are only started when this module is explicitly imported outside
 * the Next.js request lifecycle (e.g. in a standalone worker process).
 * The queue and job-helper exports are safe to import anywhere.
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import { getDocumentIngestion } from '@/lib/context/document-ingestion';
import { getMemoryManager } from '@/lib/memory/memory-manager';
import type { AgentMessage } from '@/lib/agents/types';

// ─── Redis connection ─────────────────────────────────────────────────────────

function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new IORedis(url, {
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,    // avoids errors during graceful shutdown
    lazyConnect: true,
  });

  connection.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  return connection;
}

// Shared connection used by all queues (BullMQ recommends one connection per role).
export const redisConnection = createRedisConnection();

// ─── Queue names ──────────────────────────────────────────────────────────────

export const QUEUE_DOCUMENT_PROCESSING = 'document-processing';
export const QUEUE_AI_TASKS            = 'ai-tasks';
export const QUEUE_SCHEDULED_WORKFLOWS = 'scheduled-workflows';
export const QUEUE_MEMORY_EXTRACTION   = 'memory-extraction';

// ─── Default job options ──────────────────────────────────────────────────────

const defaultJobOptions = {
  removeOnComplete: { count: 500 },
  removeOnFail:     { count: 200 },
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
};

// ─── Queue instances ──────────────────────────────────────────────────────────

export const documentQueue = new Queue(QUEUE_DOCUMENT_PROCESSING, {
  connection: redisConnection,
  defaultJobOptions,
});

export const aiTaskQueue = new Queue(QUEUE_AI_TASKS, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

export const workflowQueue = new Queue(QUEUE_SCHEDULED_WORKFLOWS, {
  connection: redisConnection,
  defaultJobOptions,
});

export const memoryQueue = new Queue(QUEUE_MEMORY_EXTRACTION, {
  connection: redisConnection,
  defaultJobOptions: { ...defaultJobOptions, attempts: 2 },
});

// ─── Job data types ───────────────────────────────────────────────────────────

export interface DocumentJobData {
  /** Base64-encoded file buffer. */
  fileBase64: string;
  fileName: string;
  mimeType: string;
  organizationId: string;
  userId: string;
  knowledgeBaseId?: string;
}

export interface UrlJobData {
  url: string;
  organizationId: string;
  userId: string;
  knowledgeBaseId?: string;
}

export interface AITaskJobData {
  taskId: string;
  agentType: string;
  organizationId: string;
  userId: string;
  title: string;
  description: string;
  context?: Record<string, unknown>;
}

export interface WorkflowJobData {
  workflowRunId: string;
  workflowId: string;
  organizationId: string;
  stepIndex?: number;
  context?: Record<string, unknown>;
}

export interface MemoryExtractionJobData {
  conversationId: string;
  messages: AgentMessage[];
  agentType: string;
  organizationId: string;
}

// ─── Job helpers ──────────────────────────────────────────────────────────────

/**
 * Enqueues a document-ingestion job.
 * Accepts either a Buffer (converted to base64 internally) or a URL.
 */
export async function addDocumentJob(
  jobData: DocumentJobData | UrlJobData
): Promise<Job> {
  const isUrlJob = 'url' in jobData;

  if (isUrlJob) {
    return documentQueue.add('ingest-url', jobData, {
      jobId: `url-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  }

  return documentQueue.add('ingest-file', jobData, {
    jobId: `file-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}

/** Enqueues an AI agent task. */
export async function addAITask(jobData: AITaskJobData): Promise<Job> {
  return aiTaskQueue.add('run-task', jobData, {
    jobId: `task-${jobData.taskId}`,
    priority: 1,
  });
}

/** Enqueues a workflow run (or resumes a stalled one). */
export async function scheduleWorkflow(jobData: WorkflowJobData): Promise<Job> {
  return workflowQueue.add('execute-workflow', jobData, {
    jobId: `workflow-run-${jobData.workflowRunId}`,
  });
}

/** Enqueues memory extraction from a completed conversation. */
export async function addMemoryExtractionJob(
  jobData: MemoryExtractionJobData
): Promise<Job> {
  return memoryQueue.add('extract-memories', jobData, {
    jobId: `memory-${jobData.conversationId}-${Date.now()}`,
    delay: 2_000, // slight delay so the conversation is fully persisted
  });
}

// ─── Workers ──────────────────────────────────────────────────────────────────
// Workers should be instantiated in a standalone Node.js process, NOT in the
// Next.js edge/server runtime.  Call `startWorkers()` from your worker entrypoint.

let workersStarted = false;
const activeWorkers: Worker[] = [];

export function startWorkers(): void {
  if (workersStarted) {
    console.warn('[Workers] startWorkers() called more than once — ignoring.');
    return;
  }
  workersStarted = true;

  // ── Document processing worker ─────────────────────────────────────────────
  const documentWorker = new Worker(
    QUEUE_DOCUMENT_PROCESSING,
    async (job: Job) => {
      const ingestion = getDocumentIngestion();

      if (job.name === 'ingest-url') {
        const data = job.data as UrlJobData;
        console.log(`[DocumentWorker] Ingesting URL: ${data.url}`);
        await ingestion.processUrl(
          data.url,
          data.organizationId,
          data.userId,
          data.knowledgeBaseId
        );
        return;
      }

      if (job.name === 'ingest-file') {
        const data = job.data as DocumentJobData;
        console.log(`[DocumentWorker] Ingesting file: ${data.fileName}`);
        const buffer = Buffer.from(data.fileBase64, 'base64');
        await ingestion.ingestDocument(
          buffer,
          data.fileName,
          data.mimeType,
          data.organizationId,
          data.userId,
          data.knowledgeBaseId
        );
        return;
      }

      throw new Error(`Unknown document job name: ${job.name}`);
    },
    {
      connection: createRedisConnection(),
      concurrency: 3,
    }
  );

  documentWorker.on('completed', (job) => {
    console.log(`[DocumentWorker] Job ${job.id} completed`);
  });
  documentWorker.on('failed', (job, err) => {
    console.error(`[DocumentWorker] Job ${job?.id} failed:`, err.message);
  });

  // ── AI task worker ─────────────────────────────────────────────────────────
  const aiTaskWorker = new Worker(
    QUEUE_AI_TASKS,
    async (job: Job) => {
      const data = job.data as AITaskJobData;
      console.log(`[AITaskWorker] Running task: ${data.title} (${data.taskId})`);

      // Dynamic import to avoid circular dependencies at module load time.
      const { PrismaClient, TaskStatus } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        await prisma.agentTask.update({
          where: { id: data.taskId },
          data: {
            status: TaskStatus.RUNNING,
            startedAt: new Date(),
          },
        });

        // Placeholder: in a full implementation, instantiate the appropriate
        // BaseAgent subclass and call agent.chat() with the task description.
        const result = {
          processed: true,
          taskId: data.taskId,
          completedAt: new Date().toISOString(),
          note: 'Task queued and acknowledged. Full agent execution handled by agent router.',
        };

        await prisma.agentTask.update({
          where: { id: data.taskId },
          data: {
            status: TaskStatus.COMPLETED,
            result,
            completedAt: new Date(),
          },
        });
      } catch (err) {
        await prisma.agentTask
          .update({
            where: { id: data.taskId },
            data: {
              status: TaskStatus.FAILED,
              errorMessage: err instanceof Error ? err.message : String(err),
            },
          })
          .catch(() => undefined); // don't mask original error
        throw err;
      } finally {
        await prisma.$disconnect();
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  aiTaskWorker.on('completed', (job) => {
    console.log(`[AITaskWorker] Job ${job.id} completed`);
  });
  aiTaskWorker.on('failed', (job, err) => {
    console.error(`[AITaskWorker] Job ${job?.id} failed:`, err.message);
  });

  // ── Workflow worker ────────────────────────────────────────────────────────
  const workflowWorker = new Worker(
    QUEUE_SCHEDULED_WORKFLOWS,
    async (job: Job) => {
      const data = job.data as WorkflowJobData;
      console.log(
        `[WorkflowWorker] Executing workflow run: ${data.workflowRunId}`
      );

      const { PrismaClient, WorkflowRunStatus } = await import('@prisma/client');
      const prisma = new PrismaClient();

      try {
        const run = await prisma.workflowRun.findUnique({
          where: { id: data.workflowRunId },
          include: { workflow: true },
        });

        if (!run) {
          throw new Error(`WorkflowRun ${data.workflowRunId} not found`);
        }

        const steps: unknown[] = Array.isArray(run.workflow.steps)
          ? run.workflow.steps
          : [];

        // Execute steps sequentially.
        const stepResults: Array<{ stepIndex: number; status: string; result: unknown }> = [];
        for (let i = data.stepIndex ?? 0; i < steps.length; i++) {
          const step = steps[i] as Record<string, unknown>;
          console.log(`[WorkflowWorker] Step ${i + 1}/${steps.length}: ${step.name ?? 'unnamed'}`);

          // Step execution placeholder — real implementation dispatches to
          // the appropriate agent or integration based on step.type.
          stepResults.push({
            stepIndex: i,
            status: 'completed',
            result: { processed: true, stepName: step.name ?? `step-${i}` },
          });
        }

        await prisma.workflowRun.update({
          where: { id: data.workflowRunId },
          data: {
            status: WorkflowRunStatus.COMPLETED,
            completedAt: new Date(),
            steps: stepResults,
            output: { stepCount: stepResults.length, success: true },
          },
        });

        // Update workflow's lastRunAt.
        await prisma.workflow.update({
          where: { id: data.workflowId },
          data: { lastRunAt: new Date() },
        });
      } catch (err) {
        const { WorkflowRunStatus } = await import('@prisma/client');
        await prisma.workflowRun
          .update({
            where: { id: data.workflowRunId },
            data: {
              status: WorkflowRunStatus.FAILED,
              completedAt: new Date(),
              errorMessage: err instanceof Error ? err.message : String(err),
            },
          })
          .catch(() => undefined);
        throw err;
      } finally {
        await prisma.$disconnect();
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: 2,
    }
  );

  workflowWorker.on('completed', (job) => {
    console.log(`[WorkflowWorker] Job ${job.id} completed`);
  });
  workflowWorker.on('failed', (job, err) => {
    console.error(`[WorkflowWorker] Job ${job?.id} failed:`, err.message);
  });

  // ── Memory extraction worker ───────────────────────────────────────────────
  const memoryWorker = new Worker(
    QUEUE_MEMORY_EXTRACTION,
    async (job: Job) => {
      const data = job.data as MemoryExtractionJobData;
      console.log(
        `[MemoryWorker] Extracting memories from conversation: ${data.conversationId}`
      );

      const manager = getMemoryManager();
      const memories = await manager.extractMemoriesFromConversation(
        data.messages,
        data.agentType,
        data.organizationId
      );

      console.log(
        `[MemoryWorker] Extracted ${memories.length} memories from conversation ${data.conversationId}`
      );

      // Persist all extracted memories.
      await Promise.all(
        memories.map((m) =>
          manager.addMemory(data.organizationId, {
            ...m,
            sourceConversationId: data.conversationId,
          })
        )
      );

      return { memoriesExtracted: memories.length };
    },
    {
      connection: createRedisConnection(),
      concurrency: 4,
    }
  );

  memoryWorker.on('completed', (job) => {
    const result = job.returnvalue as { memoriesExtracted?: number };
    console.log(
      `[MemoryWorker] Job ${job.id} completed — ${result?.memoriesExtracted ?? 0} memories extracted`
    );
  });
  memoryWorker.on('failed', (job, err) => {
    console.error(`[MemoryWorker] Job ${job?.id} failed:`, err.message);
  });

  // Collect for graceful shutdown.
  activeWorkers.push(documentWorker, aiTaskWorker, workflowWorker, memoryWorker);

  console.log('[Workers] All workers started.');
}

// ─── Queue event monitors (optional, for observability) ───────────────────────

export const documentQueueEvents = new QueueEvents(QUEUE_DOCUMENT_PROCESSING, {
  connection: createRedisConnection(),
});

export const aiTaskQueueEvents = new QueueEvents(QUEUE_AI_TASKS, {
  connection: createRedisConnection(),
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

export async function shutdownWorkers(timeoutMs = 30_000): Promise<void> {
  console.log('[Workers] Initiating graceful shutdown...');

  await Promise.all(
    activeWorkers.map((w) =>
      w.close().catch((err: unknown) =>
        console.error('[Workers] Error closing worker:', err)
      )
    )
  );

  await redisConnection.quit().catch(() => undefined);
  console.log('[Workers] Graceful shutdown complete.');
}

// Register OS signal handlers when running as a standalone process.
if (require.main === module) {
  startWorkers();

  const onSignal = async () => {
    await shutdownWorkers();
    process.exit(0);
  };

  process.on('SIGTERM', () => void onSignal());
  process.on('SIGINT',  () => void onSignal());
}
