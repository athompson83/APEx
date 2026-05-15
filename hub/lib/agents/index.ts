// ============================================================
// APEx Hub – AI Agent System: Public API
// ============================================================
//
// Import from this module for all agent-related functionality.
// Example:
//   import { getOrchestrator, AgentType, AGENT_METADATA } from '@/lib/agents';

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  AgentMessage,
  AgentContext,
  AgentResponse,
  AgentTool,
  AgentMetadata,
  SuggestedTask,
  NewMemory,
  Citation,
  RelevantDoc,
  Memory,
  StreamChunk,
} from './types';

export { AgentType, AGENT_METADATA } from './types';

// ── Base ───────────────────────────────────────────────────────────────────────
export { BaseAgent } from './base-agent';

// ── Agent implementations ──────────────────────────────────────────────────────
export { ChiefOfStaffAgent } from './chief-of-staff';
export { OperationsManagerAgent } from './operations-manager';
export { SalesManagerAgent } from './sales-manager';
export { CustomerSuccessAgent } from './customer-success';
export { AccountingAgent } from './accounting';
export { LegalOpsAgent } from './legal-ops';
export { ProductManagerAgent } from './product-manager';

// ── Orchestrator ───────────────────────────────────────────────────────────────
export { AgentOrchestrator, getOrchestrator } from './orchestrator';

// ── Tool functions (for use outside agent context if needed) ───────────────────
export {
  searchKnowledgeBase,
  getBusinessMetrics,
  getTasksSummary,
  getCustomerHealth,
  getPipelineSummary,
  createTask,
  analyzeFinancials,
  createSop,
  getWorkflows,
  createChecklist,
  analyzePipeline,
  draftOutreach,
  analyzeCustomerHealth,
  reviewDocument,
  analyzeFeedback,
} from './tools';

// ── Tool factory helpers ───────────────────────────────────────────────────────
export {
  makeSearchKnowledgeBaseTool,
  makeGetBusinessMetricsTool,
  makeGetTasksSummaryTool,
  makeGetCustomerHealthTool,
  makeGetPipelineSummaryTool,
  makeCreateTaskTool,
  makeCreateSopTool,
  makeGetWorkflowsTool,
  makeCreateChecklistTool,
  makeAnalyzePipelineTool,
  makeDraftOutreachTool,
  makeAnalyzeFinancialsTool,
  makeAnalyzeCustomerHealthTool,
  makeReviewDocumentTool,
  makeAnalyzeFeedbackTool,
} from './tools';
