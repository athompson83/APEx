/**
 * EditProfileScreen.tsx
 * Read-only profile info screen — all identity managed by Bubble.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { useAuthStore } from '@/store/authStore';

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function EditProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Field label="First Name" value={user?.['First Name']} />
          <View style={styles.divider} />
          <Field label="Last Name" value={user?.['Last Name']} />
          <View style={styles.divider} />
          <Field label="Email" value={user?.email} />
          <View style={styles.divider} />
          <Field label="APEx Role" value={user?.['APEx Role']} />
          <View style={styles.divider} />
          <Field label="Personnel ID" value={user?.['Personnel ID']} />
          <View style={styles.divider} />
          <Field label="Organization" value={user?.Organization} />
        </Card>

        <Text style={styles.notice}>
          Account details are managed by your organization's APEx360 administrator.
          Contact your admin to update this information.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backBtn: { padding: 4 },
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700', flex: 1 },
  content: { padding: 16, gap: 16 },
  field: { paddingVertical: 12 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  fieldValue: { fontSize: 15, color: colors.textPrimary },
  divider: { height: 1, backgroundColor: colors.border },
  notice: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
});
