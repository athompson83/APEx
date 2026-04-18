/**
 * navigation/index.tsx
 * Root navigator — gates between the Auth and Main navigators.
 *
 * Flow:
 *  1. On mount, calls authStore.initAuth() to restore a persisted token.
 *  2. If a token is found, validates it against Bubble (getCurrentUser).
 *  3. Shows AuthNavigator for unauthenticated users.
 *  4. Shows MainNavigator for authenticated users.
 *  5. Shows a full-screen loading state while the initial auth check runs.
 *
 * The Axios 401 interceptor in api/client.ts calls setRedirectToLogin() so
 * that session expiry automatically routes the user back to the Login screen.
 */

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Text,
} from 'react-native';
import { NavigationContainer, type NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '@/theme';
import { useAuthStore } from '@/store/authStore';
import { useEvalStore } from '@/store/evalStore';
import { setRedirectToLogin } from '@/api/client';
import { getCurrentUser } from '@/api/endpoints/auth';

import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import type { RootStackParamList } from './types';

// ─── Root stack ───────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator<RootStackParamList>();

// ─── Root navigator ───────────────────────────────────────────────────────────

export default function RootNavigator(): React.JSX.Element {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  const {
    isAuthenticated,
    isLoading,
    token,
    initAuth,
    setUser,
    clearAuth,
  } = useAuthStore();

  const clearEvalStore = useEvalStore((state) => state.clearEvalStore);

  // ── Auth initialisation ───────────────────────────────────────────────────

  useEffect(() => {
    async function bootstrap(): Promise<void> {
      // Attempt to restore a previously persisted token
      const restoredToken = await initAuth();

      if (!restoredToken) {
        // No stored token — stay on auth screen
        return;
      }

      // Token found — validate against Bubble by fetching the current user
      try {
        const user = await getCurrentUser();
        setUser(user);
      } catch {
        // Token is stale or revoked — clear auth state and show login
        await clearAuth();
        clearEvalStore();
      }
    }

    void bootstrap();
    // initAuth and setUser are stable (Zustand actions don't re-create)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 401 redirect injection ────────────────────────────────────────────────

  useEffect(() => {
    // Wire the Axios 401 interceptor to navigate the user back to Login.
    // This must happen after NavigationContainer has mounted.
    setRedirectToLogin(() => {
      void clearAuth();
      clearEvalStore();
    });
  }, [clearAuth, clearEvalStore]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return <SplashScreen />;
  }

  // ── Navigation tree ───────────────────────────────────────────────────────

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen
            name="Auth"
            component={AuthNavigator}
            options={{ animationTypeForReplace: isAuthenticated ? 'push' : 'pop' }}
          />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

// ─── Splash / loading screen ──────────────────────────────────────────────────

function SplashScreen(): React.JSX.Element {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashTitle}>APEx360</Text>
      <ActivityIndicator
        color={colors.white}
        size="large"
        style={styles.splashSpinner}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashTitle: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 32,
  },
  splashSpinner: {
    marginTop: 8,
  },
});
