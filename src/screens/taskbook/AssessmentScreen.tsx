/**
 * AssessmentScreen.tsx
 * Renders a form-based assessment requirement.
 * For quiz-based assessments, see QuizScreen.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '@/theme/colors';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { InlineLoader } from '@/components/common/LoadingSpinner';
import { getAssessment } from '@/api/endpoints/assessments';
import type { AssessmentScreenProps } from '@/navigation/types';

export default function AssessmentScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<AssessmentScreenProps['route']>();
  const { assessmentId, requirementId, rosterId } = route.params;

  const { data: assessment, isLoading } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => getAssessment(assessmentId),
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assessment</Text>
      </View>

      {isLoading ? (
        <InlineLoader size="large" />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Card>
            <Text style={styles.name}>{(assessment as any)?.Name ?? 'Assessment'}</Text>
            {(assessment as any)?.Description ? (
              <Text style={styles.desc}>{(assessment as any).Description}</Text>
            ) : null}
          </Card>
          <Button
            title="Begin Assessment"
            onPress={() => {
              const quizId = (assessment as any)?.Quiz;
              if (quizId) {
                navigation.navigate('Quiz' as never, { quizId, requirementId, rosterId } as never);
              }
            }}
            variant="primary"
            size="lg"
            fullWidth
            style={{ marginTop: 20 }}
          />
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
  headerTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  content: { padding: 16 },
  name: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  desc: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
});
