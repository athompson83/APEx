/**
 * MainNavigator.tsx
 * Bottom tab navigator for authenticated users.
 *
 * Each tab owns a stack sub-navigator so screens within a tab maintain their
 * own navigation history independently of the other tabs.
 *
 * Tab bar styling:
 *  - White background with a top shadow
 *  - Active color: primary (#1B3A6B)
 *  - Inactive color: gray400 (#94A3B8)
 *  - Icons from @expo/vector-icons (Ionicons)
 *  - Evaluations tab shows a badge with the count of items needing action
 */

import React, { useCallback } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';
import { useEvalStore } from '@/store/evalStore';
import type {
  MainTabParamList,
  EvalStackParamList,
  TaskbookStackParamList,
  ProgressStackParamList,
  ProfileStackParamList,
} from './types';

// ─── Lazy-loaded screens ──────────────────────────────────────────────────────

const DashboardScreen = React.lazy(() => import('@/screens/dashboard/DashboardScreen'));

const EvalListScreen = React.lazy(() => import('@/screens/evaluations/EvalListScreen'));
const EvalDetailScreen = React.lazy(() => import('@/screens/evaluations/EvalDetailScreen'));
const EvalScoringScreen = React.lazy(() => import('@/screens/evaluations/EvalScoringScreen'));
const EvalCreateScreen = React.lazy(() => import('@/screens/evaluations/EvalCreateScreen'));

const TaskbookHomeScreen = React.lazy(() => import('@/screens/taskbook/TaskbookHomeScreen'));
const RequirementDetailScreen = React.lazy(() => import('@/screens/taskbook/RequirementDetailScreen'));
const AssessmentScreen = React.lazy(() => import('@/screens/taskbook/AssessmentScreen'));
const QuizScreen = React.lazy(() => import('@/screens/taskbook/QuizScreen'));

const ProgressHomeScreen = React.lazy(() => import('@/screens/progress/ProgressHomeScreen'));
const RosterDetailScreen = React.lazy(() => import('@/screens/progress/RosterDetailScreen'));
const PhaseDetailScreen = React.lazy(() => import('@/screens/progress/PhaseDetailScreen'));

const ProfileHomeScreen = React.lazy(() => import('@/screens/profile/ProfileHomeScreen'));
const EditProfileScreen = React.lazy(() => import('@/screens/profile/EditProfileScreen'));
const AuditLogScreen = React.lazy(() => import('@/screens/profile/AuditLogScreen'));
const AppSettingsScreen = React.lazy(() => import('@/screens/profile/AppSettingsScreen'));

// ─── Suspense fallback ────────────────────────────────────────────────────────

function ScreenFallback(): React.JSX.Element {
  const { View: RNView, ActivityIndicator } = require('react-native') as typeof import('react-native');
  return (
    <RNView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </RNView>
  );
}

function withSuspense<P extends object>(
  Component: React.LazyExoticComponent<React.ComponentType<P>>,
): React.ComponentType<P> {
  return function SuspenseWrapper(props: P) {
    return (
      <React.Suspense fallback={<ScreenFallback />}>
        <Component {...props} />
      </React.Suspense>
    );
  };
}

// ─── Evaluations stack ────────────────────────────────────────────────────────

const EvalStack = createNativeStackNavigator<EvalStackParamList>();

function EvaluationsStackNavigator(): React.JSX.Element {
  return (
    <EvalStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <EvalStack.Screen
        name="EvalList"
        component={withSuspense(EvalListScreen)}
        options={{ title: 'Evaluations' }}
      />
      <EvalStack.Screen
        name="EvalDetail"
        component={withSuspense(EvalDetailScreen)}
        options={{ title: 'Evaluation Detail' }}
      />
      <EvalStack.Screen
        name="EvalScoring"
        component={withSuspense(EvalScoringScreen)}
        options={{ title: 'Score Evaluation', headerBackTitle: 'Back' }}
      />
      <EvalStack.Screen
        name="EvalCreate"
        component={withSuspense(EvalCreateScreen)}
        options={{ title: 'New Evaluation', presentation: 'modal' }}
      />
    </EvalStack.Navigator>
  );
}

// ─── Taskbook stack ───────────────────────────────────────────────────────────

const TaskbookStack = createNativeStackNavigator<TaskbookStackParamList>();

function TaskbookStackNavigator(): React.JSX.Element {
  return (
    <TaskbookStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <TaskbookStack.Screen
        name="TaskbookHome"
        component={withSuspense(TaskbookHomeScreen)}
        options={{ title: 'Taskbook' }}
      />
      <TaskbookStack.Screen
        name="RequirementDetail"
        component={withSuspense(RequirementDetailScreen)}
        options={{ title: 'Requirement', headerBackTitle: 'Taskbook' }}
      />
      <TaskbookStack.Screen
        name="Assessment"
        component={withSuspense(AssessmentScreen)}
        options={{ title: 'Assessment' }}
      />
      <TaskbookStack.Screen
        name="Quiz"
        component={withSuspense(QuizScreen)}
        options={{
          title: 'Quiz',
          // Prevent accidental back navigation during an active quiz
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />
    </TaskbookStack.Navigator>
  );
}

// ─── Progress stack ───────────────────────────────────────────────────────────

const ProgressStack = createNativeStackNavigator<ProgressStackParamList>();

function ProgressStackNavigator(): React.JSX.Element {
  return (
    <ProgressStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProgressStack.Screen
        name="ProgressHome"
        component={withSuspense(ProgressHomeScreen)}
        options={{ title: 'Progress' }}
      />
      <ProgressStack.Screen
        name="RosterDetail"
        component={withSuspense(RosterDetailScreen)}
        options={{ title: 'Program Roster' }}
      />
      <ProgressStack.Screen
        name="PhaseDetail"
        component={withSuspense(PhaseDetailScreen)}
        options={{ title: 'Phase Detail' }}
      />
    </ProgressStack.Navigator>
  );
}

// ─── Profile stack ────────────────────────────────────────────────────────────

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

function ProfileStackNavigator(): React.JSX.Element {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '600' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <ProfileStack.Screen
        name="ProfileHome"
        component={withSuspense(ProfileHomeScreen)}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={withSuspense(EditProfileScreen)}
        options={{ title: 'Edit Profile' }}
      />
      <ProfileStack.Screen
        name="AuditLog"
        component={withSuspense(AuditLogScreen)}
        options={{ title: 'Activity Log' }}
      />
      <ProfileStack.Screen
        name="AppSettings"
        component={withSuspense(AppSettingsScreen)}
        options={{ title: 'App Settings' }}
      />
    </ProfileStack.Navigator>
  );
}

// ─── Tab icon component ───────────────────────────────────────────────────────

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  name: IoniconName;
  focused: boolean;
  color: string;
  size: number;
}

function TabIcon({ name, focused, color, size }: TabIconProps): React.JSX.Element {
  // Use filled variant when active, outline when inactive
  const iconName: IoniconName = focused ? name : (`${name}-outline` as IoniconName);
  return <Ionicons name={iconName} size={size} color={color} />;
}

// ─── Bottom tab navigator ─────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator(): React.JSX.Element {
  // Live badge count from eval store — re-renders only when count changes
  const activeFormLogs = useEvalStore((state) => state.activeFormLogs);
  const needsActionCount = activeFormLogs.filter((log) =>
    ['draft', 'in_progress', 'pending_review', 'disputed'].includes(log.Status),
  ).length;

  const evalBadge = needsActionCount > 0 ? needsActionCount : undefined;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={withSuspense(DashboardScreen)}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="home" focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Evaluations"
        component={EvaluationsStackNavigator}
        options={{
          tabBarLabel: 'Evaluations',
          tabBarBadge: evalBadge,
          tabBarBadgeStyle: styles.badge,
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="clipboard" focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Taskbook"
        component={TaskbookStackNavigator}
        options={{
          tabBarLabel: 'Taskbook',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="checkbox" focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Progress"
        component={ProgressStackNavigator}
        options={{
          tabBarLabel: 'Progress',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="trending-up" focused={focused} color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <TabIcon name="person" focused={focused} color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.white,
    borderTopWidth: 0,
    // Top shadow — consistent cross-platform appearance
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  tabItem: {
    paddingTop: 6,
  },
  badge: {
    backgroundColor: colors.accent,
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
