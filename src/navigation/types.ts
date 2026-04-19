/**
 * navigation/types.ts
 * React Navigation TypeScript param list definitions for APEx360.
 *
 * Import typed navigation and route props from here rather than from
 * @react-navigation/* directly so all screens are consistently typed.
 */

import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type {
  BottomTabNavigationProp,
  BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams, CompositeNavigationProp, RouteProp } from '@react-navigation/native';

// ─── Auth stack ───────────────────────────────────────────────────────────────

export type AuthStackParamList = {
  Login: undefined;
};

// ─── Main tab navigator ───────────────────────────────────────────────────────

export type MainTabParamList = {
  Dashboard: undefined;
  Evaluations: undefined;
  Taskbook: undefined;
  Progress: undefined;
  Profile: undefined;
};

// ─── Evaluations stack ────────────────────────────────────────────────────────

export type EvalStackParamList = {
  /** List of all active/recent evaluations for the current user */
  EvalList: undefined;
  /**
   * Readonly detail view of a submitted/completed evaluation.
   * Also serves as the entry point into the scoring flow.
   */
  EvalDetail: { formLogId: string };
  /**
   * Active scoring screen.  Optionally scoped to a specific category.
   */
  EvalScoring: { formLogId: string; categoryId?: string };
  /**
   * Create a new evaluation log.  Optionally pre-selects a form template.
   */
  EvalCreate: { formId?: string };
};

// ─── Taskbook stack ───────────────────────────────────────────────────────────

export type TaskbookStackParamList = {
  TaskbookHome: undefined;
  RequirementDetail: { requirementId: string; rosterId: string };
  Assessment: {
    assessmentId: string;
    requirementId: string;
    rosterId: string;
  };
  Quiz: {
    quizId: string;
    requirementId: string;
    rosterId: string;
  };
};

// ─── Progress stack ───────────────────────────────────────────────────────────

export type ProgressStackParamList = {
  ProgressHome: undefined;
  RosterDetail: { rosterId: string };
  PhaseDetail: { rosterId: string; phaseId: string };
  ProgressNoteDetail: { noteId: string };
};

// ─── Profile stack ────────────────────────────────────────────────────────────

export type ProfileStackParamList = {
  ProfileHome: undefined;
  EditProfile: undefined;
  AuditLog: undefined;
  AppSettings: undefined;
};

// ─── Root stack (gate between Auth and Main) ──────────────────────────────────

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// ─── Typed navigation props ───────────────────────────────────────────────────

export type AuthNavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export type EvalNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<EvalStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

export type TaskbookNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<TaskbookStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

export type ProgressNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProgressStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

export type ProfileNavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<ProfileStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

export type RootNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Typed screen props ───────────────────────────────────────────────────────

// Auth screens
export type LoginScreenProps = NativeStackScreenProps<AuthStackParamList, 'Login'>;

// Eval screens
export type EvalListScreenProps = NativeStackScreenProps<EvalStackParamList, 'EvalList'>;
export type EvalDetailScreenProps = NativeStackScreenProps<EvalStackParamList, 'EvalDetail'>;
export type EvalScoringScreenProps = NativeStackScreenProps<EvalStackParamList, 'EvalScoring'>;
export type EvalCreateScreenProps = NativeStackScreenProps<EvalStackParamList, 'EvalCreate'>;

// Taskbook screens
export type TaskbookHomeScreenProps = NativeStackScreenProps<TaskbookStackParamList, 'TaskbookHome'>;
export type RequirementDetailScreenProps = NativeStackScreenProps<TaskbookStackParamList, 'RequirementDetail'>;
export type AssessmentScreenProps = NativeStackScreenProps<TaskbookStackParamList, 'Assessment'>;
export type QuizScreenProps = NativeStackScreenProps<TaskbookStackParamList, 'Quiz'>;

// Progress screens
export type ProgressHomeScreenProps = NativeStackScreenProps<ProgressStackParamList, 'ProgressHome'>;
export type RosterDetailScreenProps = NativeStackScreenProps<ProgressStackParamList, 'RosterDetail'>;
export type PhaseDetailScreenProps = NativeStackScreenProps<ProgressStackParamList, 'PhaseDetail'>;

// Profile screens
export type ProfileHomeScreenProps = NativeStackScreenProps<ProfileStackParamList, 'ProfileHome'>;
export type EditProfileScreenProps = NativeStackScreenProps<ProfileStackParamList, 'EditProfile'>;
export type AuditLogScreenProps = NativeStackScreenProps<ProfileStackParamList, 'AuditLog'>;
export type AppSettingsScreenProps = NativeStackScreenProps<ProfileStackParamList, 'AppSettings'>;

// Dashboard
export type DashboardScreenProps = BottomTabScreenProps<MainTabParamList, 'Dashboard'>;

// ─── Route prop helpers ───────────────────────────────────────────────────────

export type EvalDetailRouteProp = RouteProp<EvalStackParamList, 'EvalDetail'>;
export type EvalScoringRouteProp = RouteProp<EvalStackParamList, 'EvalScoring'>;
export type RequirementDetailRouteProp = RouteProp<TaskbookStackParamList, 'RequirementDetail'>;
export type AssessmentRouteProp = RouteProp<TaskbookStackParamList, 'Assessment'>;
export type QuizRouteProp = RouteProp<TaskbookStackParamList, 'Quiz'>;
export type RosterDetailRouteProp = RouteProp<ProgressStackParamList, 'RosterDetail'>;
export type PhaseDetailRouteProp = RouteProp<ProgressStackParamList, 'PhaseDetail'>;
