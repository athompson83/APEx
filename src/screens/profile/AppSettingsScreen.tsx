/**
 * AppSettingsScreen.tsx
 * App-level settings: cache management, offline queue status.
 */

import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { useUIStore } from '@/store/uiStore';
import { getQueueLength, flushQueue } from '@/services/offlineQueue';

export default function AppSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const addToast = useUIStore((s) => s.addToast);
  const isOnline = useUIStore((s) => s.isOnline);
  const [queueLength, setQueueLength] = useState<number | null>(null);

  const checkQueue = useCallback(async () => {
    const len = await getQueueLength();
    setQueueLength(len);
  }, []);

  const handleFlushQueue = useCallback(() => {
    Alert.alert('Flush Offline Queue', 'Attempt to sync all queued changes now?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sync Now',
        onPress: async () => {
          try {
            await flushQueue();
            addToast('Offline queue synced', 'success');
          } catch {
            addToast('Sync failed — will retry automatically', 'error');
          }
        },
      },
    ]);
  }, [addToast]);

  const handleClearCache = useCallback(() => {
    Alert.alert('Clear Cache', 'Remove all locally cached data? You will need to reload.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          queryClient.clear();
          addToast('Cache cleared', 'success');
        },
      },
    ]);
  }, [queryClient, addToast]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Network status */}
        <Card>
          <View style={styles.row}>
            <Ionicons
              name={isOnline ? 'wifi' : 'wifi-outline'}
              size={20}
              color={isOnline ? colors.success : colors.danger}
            />
            <Text style={styles.rowLabel}>Network Status</Text>
            <Text style={[styles.rowValue, { color: isOnline ? colors.success : colors.danger }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </Card>

        {/* Offline queue */}
        <Card>
          <TouchableOpacity style={styles.row} onPress={checkQueue}>
            <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Offline Queue</Text>
              {queueLength !== null && (
                <Text style={styles.rowMeta}>{queueLength} item(s) pending</Text>
              )}
            </View>
            <Text style={styles.checkLink}>Check</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.row} onPress={handleFlushQueue}>
            <Ionicons name="sync-outline" size={20} color={colors.primary} />
            <Text style={styles.rowLabel}>Sync Now</Text>
          </TouchableOpacity>
        </Card>

        {/* Cache */}
        <Card>
          <TouchableOpacity style={styles.row} onPress={handleClearCache}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
            <Text style={[styles.rowLabel, { color: colors.danger }]}>Clear Local Cache</Text>
          </TouchableOpacity>
        </Card>

        <Text style={styles.notice}>
          All data is sourced from APEx360 (Bubble.io). Clearing the cache forces a full data
          reload on next use. The offline queue stores unsaved changes when network is unavailable.
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
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowContent: { flex: 1 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: '600' },
  checkLink: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  notice: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
