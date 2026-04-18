/**
 * types/index.ts
 * Central export barrel for all APEx360 TypeScript types.
 *
 * Import from '@/types' rather than individual type files to keep
 * imports clean throughout the codebase.
 *
 * Where a module-specific file exists (user.ts, evalForm.ts, etc.) its
 * types are the authoritative source.  Legacy inline types are preserved
 * below for backward-compatibility while the codebase migrates.
 */

// ---------------------------------------------------------------------------
// Domain model types — from dedicated module files
// ---------------------------------------------------------------------------

export type {
  APExRole,
  BubbleUser,
  AuthState,
  LoginCredentials,
  AuthTokenResponse,
} from './user';
export { getUserDisplayName, getUserInitials } from './user';

export type {
  BubbleEvalScoreLevel,
  BubbleEvalScoreSettings,
  BubbleEvalCategoryAttribute,
  BubbleEvalCategory,
  BubbleEvalFormSettings,
  BubbleEvalForm,
} from './evalForm';
export { scoreSettingsToLevels } from './evalForm';

export type {
  EvalStatus,
  BubbleEvalScoreLog,
  BubbleEvalFormLog,
} from './evalFormLog';
export {
  isEvalEditable,
  isEvalTerminal,
  evalStatusLabels,
} from './evalFormLog';

export type {
  WorkflowAction,
  BubbleFormWorkflow,
  BubbleFormWorkflowStep,
  WorkflowStepStatus,
  BubbleWorkflowStepLog,
  BubbleEvalWorkflowLog,
} from './workflow';

export type {
  TaskRequirementType as RosterRequirementType,
  BubblePhaseRequirement,
  BubbleProgramPhase,
  BubbleProgram,
  BubbleProgramRoster,
} from './roster';

export type {
  TaskRequirementType,
  BubbleTask,
  BubbleTaskbookLog,
} from './taskbook';

export type {
  BubbleAssessmentQuestion,
  BubbleQuiz,
  BubbleAssessment,
  BubbleTestResult,
} from './assessment';

export type { ShiftStatus, BubbleShiftSchedule } from './shift';

export type {
  ProgressNoteReason,
  BubbleProgressNote,
} from './progressNote';

export type { LogAction, BubbleUserLog } from './userLog';
export { logActionLabels } from './userLog';

export type {
  BubbleListResponse,
  BubbleDetailResponse,
  BubbleCreateResponse,
  BubbleWorkflowResponse,
  BubbleConstraint,
  ApiError,
  PaginationParams,
  FilterParams,
  SortOptions,
  ListQueryParams,
} from './api';
export { isApiError } from './api';

// ---------------------------------------------------------------------------
// Bubble base object (shared mixin fields on every Bubble record)
// ---------------------------------------------------------------------------

/** Every object returned by the Bubble Data API carries these system fields. */
export interface BubbleObject {
  _id: string;
  /** ISO 8601 creation timestamp (Bubble system field) */
  'Created Date': string;
  /** ISO 8601 last-modified timestamp (Bubble system field) */
  'Modified Date': string;
  /** Bubble _id of the user who created the record */
  'Created By': string;
  /** Bubble internal type name — e.g. "EvalFormLog" */
  _type: string;
}

// ---------------------------------------------------------------------------
// Offline queue
// ---------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * A queued API mutation to be retried when network connectivity is restored.
 */
export interface QueuedMutation {
  /** Client-generated UUID for de-duplication */
  id: string;
  method: HttpMethod;
  url: string;
  data?: unknown;
  /** Unix timestamp (ms) when this mutation was enqueued */
  enqueuedAt: number;
  retryCount: number;
  maxRetries: number;
}

// ---------------------------------------------------------------------------
// Navigation param types
// ---------------------------------------------------------------------------

/** Root stack navigator — auth gate + main app */
export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

/** Auth sub-stack */
export type AuthStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
};

/** Main bottom tab navigator */
export type MainTabParamList = {
  Dashboard: undefined;
  Evaluations: undefined;
  Roster: undefined;
  Taskbook: undefined;
  Profile: undefined;
};

/** Evaluations stack */
export type EvaluationsStackParamList = {
  EvalList: undefined;
  EvalDetail: { evalLogId: string };
  EvalForm: { evalLogId: string; evalFormId: string };
  EvalReview: { evalLogId: string };
  EvalComplete: { evalLogId: string };
};

/** Roster stack */
export type RosterStackParamList = {
  RosterList: undefined;
  RosterDetail: { rosterId: string };
  PhaseDetail: { rosterId: string; phaseId: string };
  RequirementDetail: {
    rosterId: string;
    phaseId: string;
    requirementId: string;
  };
};

/** Taskbook stack */
export type TaskbookStackParamList = {
  TaskList: undefined;
  TaskDetail: { taskId: string; requirementId?: string };
  TaskComplete: { taskLogId: string };
};

/** Profile / settings stack */
export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  AuditLog: undefined;
  AuditLogDetail: { logId: string };
  AppSettings: undefined;
};

// ---------------------------------------------------------------------------
// Utility types
// ---------------------------------------------------------------------------

/** Deep partial — makes all nested properties optional. */
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

/** Extracts the element type from an array type. */
export type ElementOf<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never;

/**
 * Branded nominal type helper.
 * Example: type UserId = Branded<string, 'UserId'>
 */
export type Branded<T, Brand extends string> = T & {
  readonly __brand: Brand;
};

/** Nominal string type for Bubble record IDs. */
export type BubbleId = Branded<string, 'BubbleId'>;

/** Single-response wrapper (alias kept for backward compat with existing code) */
export interface BubbleSingleResponse<T> {
  response: T;
}

/** Raw list response wrapper (alias kept for backward compat) */
export interface BubbleRawListResponse<T> {
  response: {
    results: T[];
    count: number;
    remaining: number;
  };
}
