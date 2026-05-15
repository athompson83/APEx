// ============================================================
// APEx Hub – AI Agent System: Core Types
// ============================================================

export enum AgentType {
  CHIEF_OF_STAFF = 'CHIEF_OF_STAFF',
  OPERATIONS_MANAGER = 'OPERATIONS_MANAGER',
  SALES_MANAGER = 'SALES_MANAGER',
  CUSTOMER_SUCCESS = 'CUSTOMER_SUCCESS',
  ACCOUNTING = 'ACCOUNTING',
  LEGAL_OPS = 'LEGAL_OPS',
  PRODUCT_MANAGER = 'PRODUCT_MANAGER',
}

// ── Conversation ──────────────────────────────────────────────

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// ── Context injected into every agent call ────────────────────

export interface Memory {
  id: string;
  content: string;
  type: string;
  confidence: number;
  tags: string[];
  agentType?: string;
}

export interface RelevantDoc {
  id: string;
  name: string;
  content: string;
  relevance: number;
}

export interface AgentContext {
  organizationId: string;
  userId: string;
  agentType: AgentType;
  memories: Memory[];
  documents: RelevantDoc[];
  conversationHistory: AgentMessage[];
  orgSettings?: Record<string, unknown>;
}

// ── Structured outputs ────────────────────────────────────────

export interface SuggestedTask {
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  agentType: AgentType;
  scheduledFor?: Date;
}

export interface NewMemory {
  content: string;
  type: string;
  confidence: number;
  tags: string[];
}

export interface Citation {
  documentId: string;
  documentName: string;
  excerpt: string;
  relevance: number;
}

export interface AgentResponse {
  content: string;
  structured?: Record<string, unknown>;
  tasks?: SuggestedTask[];
  memories?: NewMemory[];
  citations?: Citation[];
}

// ── Tool system ───────────────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  parameters: object;
  execute: (params: Record<string, unknown>, ctx: AgentContext) => Promise<unknown>;
}

// ── Streaming ─────────────────────────────────────────────────

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

// ── Agent metadata (UI) ───────────────────────────────────────

export interface AgentMetadata {
  type: AgentType;
  name: string;
  description: string;
  icon: string;        // lucide-react icon name
  color: string;       // Tailwind bg-* class
  capabilities: string[];
}

export const AGENT_METADATA: Record<AgentType, AgentMetadata> = {
  [AgentType.CHIEF_OF_STAFF]: {
    type: AgentType.CHIEF_OF_STAFF,
    name: 'Chief of Staff',
    description:
      'Strategic command center — synthesizes all business signals, surfaces risks, and keeps the founder focused on highest-leverage work.',
    icon: 'Crown',
    color: 'bg-violet-600',
    capabilities: [
      'Business status summaries',
      'Priority stack-ranking',
      'Cross-functional coordination',
      'Board & investor prep',
      'Strategic decision support',
    ],
  },
  [AgentType.OPERATIONS_MANAGER]: {
    type: AgentType.OPERATIONS_MANAGER,
    name: 'Operations Manager',
    description:
      'Builds and maintains the operational backbone — SOPs, workflows, checklists, and onboarding plans.',
    icon: 'Settings2',
    color: 'bg-blue-600',
    capabilities: [
      'SOP creation & management',
      'Process documentation',
      'Implementation checklists',
      'Onboarding plan design',
      'Workflow optimization',
    ],
  },
  [AgentType.SALES_MANAGER]: {
    type: AgentType.SALES_MANAGER,
    name: 'Sales Manager',
    description:
      'Drives B2B SaaS revenue — pipeline analysis, lead scoring, outbound messaging, and proposal drafts for healthcare/public safety.',
    icon: 'TrendingUp',
    color: 'bg-green-600',
    capabilities: [
      'Pipeline analysis & forecasting',
      'Lead scoring & qualification',
      'Outreach message drafting',
      'Proposal & deck assistance',
      'CRM data hygiene',
    ],
  },
  [AgentType.CUSTOMER_SUCCESS]: {
    type: AgentType.CUSTOMER_SUCCESS,
    name: 'Customer Success',
    description:
      'Protects and grows revenue by monitoring customer health, flagging churn risk, and guiding onboarding.',
    icon: 'HeartHandshake',
    color: 'bg-teal-600',
    capabilities: [
      'Support ticket triage',
      'Customer health scoring',
      'Churn risk detection',
      'Onboarding guidance',
      'Knowledge base management',
    ],
  },
  [AgentType.ACCOUNTING]: {
    type: AgentType.ACCOUNTING,
    name: 'Accounting',
    description:
      'Keeps the financial engine clean — MRR tracking, runway analysis, expense categorization, and SaaS metrics.',
    icon: 'Calculator',
    color: 'bg-amber-600',
    capabilities: [
      'MRR / ARR tracking',
      'Runway & cash-flow analysis',
      'Expense categorization',
      'Invoice management',
      'SaaS financial metrics',
    ],
  },
  [AgentType.LEGAL_OPS]: {
    type: AgentType.LEGAL_OPS,
    name: 'Legal Ops',
    description:
      'Manages legal risk — contract summaries, red-flag clauses, compliance reminders, and renewal tracking.',
    icon: 'Scale',
    color: 'bg-slate-600',
    capabilities: [
      'Contract summarization',
      'Risk clause flagging',
      'Compliance reminders',
      'Renewal tracking',
      'Policy documentation',
    ],
  },
  [AgentType.PRODUCT_MANAGER]: {
    type: AgentType.PRODUCT_MANAGER,
    name: 'Product Manager',
    description:
      'Shapes the product roadmap — feature prioritization, release planning, bug-trend analysis, and user-feedback synthesis for healthcare/EMS software.',
    icon: 'Layers',
    color: 'bg-rose-600',
    capabilities: [
      'Roadmap prioritization',
      'Feature analysis & scoping',
      'Bug trend analysis',
      'Release planning',
      'User feedback synthesis',
    ],
  },
};
