/**
 * PhaseDetailScreen.tsx
 * Detail view for a program phase — requirements, min averages, eval counts.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { getPhaseRequirements } from '@/api/endpoints/rosters';
import type { PhaseDetailScreenProps } from '@/navigation/types';

export default function PhaseDetailScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<PhaseDetailScreenProps['route']>();
  const { rosterId, phaseId } = route.params;

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['phaseRequirements', phaseId],
    queryFn: () => getPhaseRequirements(phaseId),
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phase Requirements</Text>
      </View>

      {isLoading ? (
        <InlineLoader size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {requirements.map((req) => (
            <Card key={req._id} style={styles.reqCard}>
              <Text style={styles.reqName}>{req.Name}</Text>
              {req.Description ? (
                <Text style={styles.reqDesc}>{req.Description}</Text>
              ) : null}
              <View style={styles.reqMeta}>
                {req['Task (y/n)'] === 'yes' && (
                  <View style={styles.reqTag}><Text style={styles.reqTagText}>Task</Text></View>
                )}
                {req['Skill (y/n)'] === 'yes' && (
                  <View style={[styles.reqTag, { backgroundColor: colors.primaryLight }]}>
                    <Text style={styles.reqTagText}>Skill</Text>
                  </View>
                )}
                {req['Assessment (y/n)'] === 'yes' && (
                  <View style={[styles.reqTag, { backgroundColor: colors.warning }]}>
                    <Text style={styles.reqTagText}>Assessment</Text>
                  </View>
                )}
                {req['Assignment (y/n)'] === 'yes' && (
                  <View style={[styles.reqTag, { backgroundColor: colors.success }]}>
                    <Text style={styles.reqTagText}>Assignment</Text>
                  </View>
                )}
              </View>
            </Card>
          ))}

          {requirements.length === 0 && (
            <Text style={styles.empty}>No requirements defined for this phase.</Text>
          )}
        </ScrollView>
      )}
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
  content: { padding: 16, gap: 10 },
  reqCard: { marginBottom: 0 },
  reqName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  reqDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 20 },
  reqMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  reqTag: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reqTagText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', color: colors.textSecondary, fontSize: 15, marginTop: 40 },
});
