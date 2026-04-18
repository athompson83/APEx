/**
 * AuthNavigator.tsx
 * Stack navigator for unauthenticated users.
 *
 * Dark primary background (#1B3A6B) is set at the navigator level so all
 * auth screens inherit it without individual configuration.  The header is
 * hidden — auth screens manage their own layout.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme';
import type { AuthStackParamList } from './types';

// ─── Screen imports ───────────────────────────────────────────────────────────
// Screens will exist alongside or be created separately; referenced by path.

const LoginScreen = React.lazy(
  () => import('@/screens/auth/LoginScreen'),
);

// ─── Navigator ────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator(): React.JSX.Element {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: colors.primary,
        },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreenWrapper}
        options={{ title: 'Sign In' }}
      />
    </Stack.Navigator>
  );
}

// ─── Suspense wrapper ─────────────────────────────────────────────────────────
// Wrap lazy-loaded screen in Suspense with a primary-background fallback so
// there is no flash of white while the component loads.

import { View, ActivityIndicator } from 'react-native';

function LoginScreenWrapper(): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <View
          style={{
            flex: 1,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.white} size="large" />
        </View>
      }
    >
      <LoginScreen />
    </React.Suspense>
  );
}
