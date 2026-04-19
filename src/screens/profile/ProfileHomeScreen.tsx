/**
 * ProfileHomeScreen.tsx
 * User profile, role display, and sign-out.
 */

import React, { useCallback } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { Badge } from '@/components/common/Badge';
import { useAuth } from '@/hooks/useAuth';

const ROLE_COLORS: Record<string, string> = {
  reviewer: colors.accent,
  evaluator: colors.success,
  subject: colors.info,
  admin: colors.danger,
};

function SettingRow({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={destructive ? colors.danger : colors.primary} />
      <Text style={[styles.settingLabel, destructive && styles.destructiveLabel]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.gray300} />
    </TouchableOpacity>
  );
}

export default function ProfileHomeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user, logout } = useAuth();

  const role = user?.['APEx Role'] ?? 'subject';
  const displayName = [user?.['First Name'], user?.['Last Name']].filter(Boolean).join(' ') || user?.email;
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  }, [logout]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Identity card */}
        <Card style={styles.identityCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {(user?.['First Name']?.[0] ?? '') + (user?.['Last Name']?.[0] ?? '')}
            </Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleRow}>
            <Badge
              label={role.charAt(0).toUpperCase() + role.slice(1)}
              color={ROLE_COLORS[role] ?? colors.primary}
              textColor={colors.white}
            />
          </View>
          {user?.['Personnel ID'] && (
            <Text style={styles.personnelId}>Personnel ID: {user['Personnel ID']}</Text>
          )}
          {user?.Organization && (
            <Text style={styles.org}>{user.Organization}</Text>
          )}
        </Card>

        {/* Settings */}
        <Card style={styles.settingsCard}>
          <SettingRow
            icon="document-text-outline"
            label="Audit Log"
            onPress={() => navigation.navigate('AuditLog' as never)}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="settings-outline"
            label="App Settings"
            onPress={() => navigation.navigate('AppSettings' as never)}
          />
        </Card>

        {/* Sign out */}
        <Card style={styles.settingsCard}>
          <SettingRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleSignOut}
            destructive
          />
        </Card>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>APEx360 v{appVersion}</Text>
          <Text style={styles.appInfoText}>Powered by APEx360 · Built for EMS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  identityCard: { alignItems: 'center', paddingVertical: 24 },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitials: { color: colors.white, fontSize: 24, fontWeight: '700' },
  displayName: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  roleRow: { marginTop: 10 },
  personnelId: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
  org: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  settingsCard: { paddingVertical: 4 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  settingLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  destructiveLabel: { color: colors.danger },
  divider: { height: 1, backgroundColor: colors.border },
  appInfo: { alignItems: 'center', paddingVertical: 16, gap: 4 },
  appInfoText: { fontSize: 12, color: colors.gray400 },
});
