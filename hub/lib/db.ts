/**
 * Prisma Client Singleton
 *
 * In development, Next.js hot-reload creates multiple module instances which
 * would exhaust the database connection pool. We cache the client on the
 * Node.js global object so a single connection pool is reused across reloads.
 *
 * In production, module-level singletons are stable — the global cache is
 * never populated but the exported `db` instance is always reused.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    errorFormat: "pretty",
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export default db;

// ---------------------------------------------------------------------------
// Type re-exports for convenience
// ---------------------------------------------------------------------------
export type {
  User,
  Organization,
  OrganizationMember,
  Agent,
  AgentConversation,
  AgentTask,
  KnowledgeBase,
  Document,
  DocumentChunk,
  Memory,
  Workflow,
  WorkflowRun,
  Integration,
  AuditLog,
} from "@prisma/client";

export {
  UserRole,
  OrgMemberRole,
  AgentType,
  ConversationStatus,
  TaskStatus,
  TaskPriority,
  KnowledgeBaseType,
  DocumentType,
  DocumentStatus,
  MemoryType,
  WorkflowStatus,
  WorkflowRunStatus,
} from "@prisma/client";
