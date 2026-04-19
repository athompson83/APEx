/**
 * ProgressHomeScreen.tsx
 * Progress notes screen. Reviewers see all subjects; evaluators see their subjects;
 * subjects see their own notes (read-only).
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { EmptyState } from '@/components/common/EmptyState';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useAudit } from '@/hooks/useAudit';
import { getProgressNotes, createProgressNote } from '@/api/endpoints/progressNotes';
import { getSubjectRosters } from '@/api/endpoints/rosters';
import type { BubbleProgressNote } from '@/types';

const REASON_OPTIONS = ['General', 'Performance', 'Concern', 'Commendation', 'Administrative'];

export default function ProgressHomeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const addToast = useUIStore((s) => s.addToast);
  const { logNoteAdded } = useAudit();
  const queryClient = useQueryClient();

  const isReviewer = user?.['APEx Role'] === 'reviewer' || user?.['APEx Role'] === 'admin';
  const isEvaluator = user?.['APEx Role'] === 'evaluator';

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    isReviewer || isEvaluator ? null : user?._id ?? null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteReason, setNoteReason] = useState(REASON_OPTIONS[0]);
  const [modalSubjectId, setModalSubjectId] = useState<string | null>(null);

  const { data: subjectRosters = [] } = useQuery({
    queryKey: ['subjectRosters', user?._id],
    queryFn: () => getSubjectRosters(user!._id),
    enabled: (isReviewer || isEvaluator) && !!user,
  });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['progressNotes', selectedSubjectId],
    queryFn: () => getProgressNotes(selectedSubjectId!),
    enabled: !!selectedSubjectId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createProgressNote({
        Subject: modalSubjectId ?? selectedSubjectId ?? user?._id,
        Creator: user?._id,
        Note: noteText.trim(),
        Reason: noteReason,
      }),
    onSuccess: (note) => {
      void queryClient.invalidateQueries({ queryKey: ['progressNotes'] });
      void logNoteAdded(note._id, note.Subject as string);
      addToast('Note added', 'success');
      setShowAddModal(false);
      setNoteText('');
    },
    onError: () => addToast('Failed to add note', 'error'),
  });

  const openAddNote = useCallback(
    (subjectId: string) => {
      setModalSubjectId(subjectId);
      setShowAddModal(true);
    },
    [],
  );

  // ── Subject list for reviewer/evaluator ───────────────────────────────────
  if ((isReviewer || isEvaluator) && !selectedSubjectId) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Progress Notes</Text>
        </View>
        {subjectRosters.length === 0 ? (
          <EmptyState icon="people-outline" title="No Subjects" message="No subjects assigned." />
        ) : (
          <FlatList
            data={subjectRosters}
            keyExtractor={(r) => r._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item: roster }) => (
              <Card style={styles.subjectCard} onPress={() => setSelectedSubjectId(roster.Subject as string)}>
                <View style={styles.subjectRow}>
                  <View>
                    <Text style={styles.subjectName}>
                      {(roster as any)['Subject Name'] ?? 'Subject'}
                    </Text>
                    <Text style={styles.subjectMeta}>{(roster as any)['Program Name']}</Text>
                  </View>
                  {isReviewer && (
                    <TouchableOpacity
                      onPress={() => openAddNote(roster.Subject as string)}
                      style={styles.addBtn}
                    >
                      <Ionicons name="add-circle" size={28} color={colors.primary} />
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Notes list ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        {selectedSubjectId && (isReviewer || isEvaluator) && (
          <TouchableOpacity onPress={() => setSelectedSubjectId(null)} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Progress Notes</Text>
        {(isReviewer || isEvaluator) && selectedSubjectId && (
          <TouchableOpacity
            onPress={() => openAddNote(selectedSubjectId)}
            style={styles.headerAction}
          >
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <InlineLoader size="large" />
      ) : notes.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No Notes"
          message="No progress notes recorded yet."
          action={
            isReviewer && selectedSubjectId
              ? { label: 'Add Note', onPress: () => openAddNote(selectedSubjectId) }
              : undefined
          }
        />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n._id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: note }) => (
            <Card style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Badge label={note.Reason ?? 'General'} color={colors.primary} textColor={colors.white} size="sm" />
                <Text style={styles.noteDate}>
                  {note['Creation Date']
                    ? format(new Date(note['Creation Date']), 'MMM d, yyyy')
                    : ''}
                </Text>
              </View>
              <Text style={styles.noteText}>{note.Note}</Text>
              {(note as any)['Creator Name'] && (
                <Text style={styles.noteAuthor}>— {(note as any)['Creator Name']}</Text>
              )}
            </Card>
          )}
        />
      )}

      {/* Add Note Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Progress Note</Text>
            <TouchableOpacity
              onPress={() => createMutation.mutate()}
              disabled={!noteText.trim() || createMutation.isPending}
            >
              <Text
                style={[
                  styles.modalSave,
                  (!noteText.trim() || createMutation.isPending) && styles.modalSaveDisabled,
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.fieldLabel}>Reason</Text>
            <View style={styles.reasonRow}>
              {REASON_OPTIONS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setNoteReason(r)}
                  style={[styles.reasonChip, noteReason === r && styles.reasonChipSelected]}
                >
                  <Text
                    style={[styles.reasonChipText, noteReason === r && styles.reasonChipTextSelected]}
                  >
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Note</Text>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Enter progress note…"
              placeholderTextColor={colors.gray400}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              autoFocus
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  headerAction: { padding: 4 },
  listContent: { padding: 16, gap: 10 },
  subjectCard: { marginBottom: 0 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subjectName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subjectMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  addBtn: { padding: 4 },
  noteCard: { marginBottom: 0 },
  noteHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  noteDate: { fontSize: 12, color: colors.textSecondary },
  noteText: { fontSize: 15, color: colors.textPrimary, lineHeight: 22 },
  noteAuthor: { fontSize: 12, color: colors.textSecondary, marginTop: 8, fontStyle: 'italic' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  modalCancel: { color: colors.danger, fontSize: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  modalSave: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  modalSaveDisabled: { opacity: 0.4 },
  modalContent: { padding: 16, gap: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  reasonChip: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reasonChipSelected: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  reasonChipText: { fontSize: 13, color: colors.textSecondary },
  reasonChipTextSelected: { color: colors.primary, fontWeight: '600' },
  noteInput: {
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 120,
  },
});
