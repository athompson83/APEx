/**
 * RoleAwareBanner.tsx
 * Banner shown at top of dashboard indicating user's role, program context,
 * and high-level status summary.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BubbleUser } from '@/types/user';
import { getUserDisplayName } from '@/types/user';
import { colors } from '@/theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface RoleAwareBannerProps {
  user: BubbleUser;
  /** Present for subjects enrolled in a program */
  rosterInfo?: {
    programName: string;
    phaseName: string;
    phaseRank: number;
    completionPct?: number;
  } | null;
  /** For evaluators: how many subjects assigned */
  assignedSubjectCount?: number;
  /** For reviewers: how many evals in review queue */
  reviewQueueCount?: number;
}

// ─── Role config ──────────────────────────────────────────────────────────────

interface RoleBannerConfig {
  icon: string;
  iconBg: string;
  iconColor: string;
  bannerBg: string;
  borderColor: string;
  roleLabel: string;
  labelColor: string;
}

const ROLE_CONFIG: Record<string, RoleBannerConfig> = {
  subject: {
    icon: 'person-circle',
    iconBg: '#EFF6FF',
    iconColor: colors.info,
    bannerBg: '#EFF6FF',
    borderColor: '#BFDBFE',
    roleLabel: 'Trainee',
    labelColor: colors.info,
  },
  evaluator: {
    icon: 'shield-checkmark',
    iconBg: '#F0FDF4',
    iconColor: colors.success,
    bannerBg: '#F0FDF4',
    borderColor: '#BBF7D0',
    roleLabel: 'Evaluator',
    labelColor: colors.success,
  },
  reviewer: {
    icon: 'eye-circle',
    iconBg: colors.warningLight,
    iconColor: colors.warning,
    bannerBg: colors.warningLight,
    borderColor: '#FDE68A',
    roleLabel: 'Reviewer',
    labelColor: colors.warning,
  },
  admin: {
    icon: 'settings',
    iconBg: '#F5F3FF',
    iconColor: '#6D28D9',
    bannerBg: '#F5F3FF',
    borderColor: '#DDD6FE',
    roleLabel: 'Administrator',
    labelColor: '#6D28D9',
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function RoleAwareBanner({
  user,
  rosterInfo,
  assignedSubjectCount,
  reviewQueueCount,
}: RoleAwareBannerProps): React.ReactElement {
  const role = user['APEx Role'];
  const config = ROLE_CONFIG[role] ?? ROLE_CONFIG['subject'];
  const displayName = getUserDisplayName(user);
  const firstName = user['First Name'] ?? displayName.split(' ')[0] ?? displayName;

  function renderSubContent(): React.ReactNode {
    switch (role) {
      case 'subject':
        if (rosterInfo) {
          return (
            <View style={styles.subContent}>
              <View style={styles.programRow}>
                <Ionicons name="book-outline" size={13} color={config.labelColor} />
                <Text style={[styles.programText, { color: config.labelColor }]} numberOfLines={2}>
                  {rosterInfo.programName}
                </Text>
              </View>
              <View style={styles.programRow}>
                <Ionicons name="layers-outline" size={13} color={config.labelColor} />
                <Text style={[styles.programText, { color: config.labelColor }]}>
                  Phase {rosterInfo.phaseRank}: {rosterInfo.phaseName}
                </Text>
              </View>
              {rosterInfo.completionPct !== undefined ? (
                <View style={styles.progressWrapper}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, rosterInfo.completionPct)}%`,
                          backgroundColor: config.labelColor,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: config.labelColor }]}>
                    {rosterInfo.completionPct}% complete
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }
        return (
          <Text style={[styles.subText, { color: config.labelColor }]}>
            No active program enrollment
          </Text>
        );

      case 'evaluator':
        if (assignedSubjectCount !== undefined) {
          return (
            <View style={styles.programRow}>
              <Ionicons name="people-outline" size={13} color={config.labelColor} />
              <Text style={[styles.programText, { color: config.labelColor }]}>
                {assignedSubjectCount} assigned subject{assignedSubjectCount !== 1 ? 's' : ''}
              </Text>
            </View>
          );
        }
        return null;

      case 'reviewer':
        if (reviewQueueCount !== undefined) {
          return (
            <View style={styles.programRow}>
              <Ionicons name="clipboard-outline" size={13} color={config.labelColor} />
              <Text style={[styles.programText, { color: config.labelColor }]}>
                {reviewQueueCount} evaluation{reviewQueueCount !== 1 ? 's' : ''} pending review
              </Text>
            </View>
          );
        }
        return null;

      case 'admin':
        return (
          <Text style={[styles.subText, { color: config.labelColor }]}>
            Full administrative access
          </Text>
        );

      default:
        return null;
    }
  }

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: config.bannerBg, borderColor: config.borderColor },
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrapper, { backgroundColor: config.iconBg }]}>
        <Ionicons
          name={config.icon as React.ComponentProps<typeof Ionicons>['name']}
          size={28}
          color={config.iconColor}
        />
      </View>

      {/* Text content */}
      <View style={styles.textBlock}>
        <View style={styles.nameRow}>
          <Text style={styles.greeting} numberOfLines={1}>
            {firstName}
          </Text>
          <View
            style={[
              styles.rolePill,
              { backgroundColor: config.iconBg, borderColor: config.borderColor },
            ]}
          >
            <Text style={[styles.rolePillText, { color: config.labelColor }]}>
              {config.roleLabel}
            </Text>
          </View>
        </View>
        {renderSubContent()}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  greeting: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  rolePill: {
    borderRadius: 9999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  subContent: {
    gap: 4,
  },
  programRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  programText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    flex: 1,
  },
  subText: {
    fontSize: 13,
    fontWeight: '500',
  },
  progressWrapper: {
    gap: 4,
    marginTop: 4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
