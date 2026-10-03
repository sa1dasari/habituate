import React, { useMemo } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarStack from './AvatarStack';
import { useAppTheme } from '../hooks/useAppTheme';
import { useChallenges } from '../hooks/useChallenges';
import { radii, shadow, spacing } from '../theme';

/** Pure browse-and-join view for the Challenges "Browse" link — creating lives in CreateChallengeModal. */
export default function ChallengesManageModal({ visible, onClose }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { browseList, busy, joinChallenge } = useChallenges();

  const handleJoin = async (challengeId) => {
    const ok = await joinChallenge(challengeId);
    if (!ok) Alert.alert("Couldn't join", 'Something went wrong — try again.');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Public Challenges</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {browseList.length === 0 ? (
            <Text style={styles.emptyNote}>No public challenges right now.</Text>
          ) : (
            browseList.map((challenge) => (
              <View key={challenge.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {challenge.name}
                  </Text>
                  {!challenge.joined ? (
                    <Pressable
                      style={styles.primaryButtonSmall}
                      disabled={busy}
                      onPress={() => handleJoin(challenge.id)}
                    >
                      <Text style={styles.primaryButtonText}>Join</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.joinedLabel}>Joined</Text>
                  )}
                </View>
                <Text style={styles.cardMeta}>
                  Target {challenge.targetCount} days · ends {challenge.periodEnd}
                </Text>
                <AvatarStack people={challenge.participants} total={challenge.participantCount} size={22} />
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(colors, typography) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { ...typography.sectionTitle },
    closeBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
    primaryButtonSmall: {
      backgroundColor: colors.accent,
      borderRadius: radii.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    primaryButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    emptyNote: { ...typography.meta },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      ...shadow,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    cardName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flexShrink: 1 },
    cardMeta: { ...typography.meta, marginTop: 2, marginBottom: spacing.md },
    joinedLabel: { fontSize: 12, fontWeight: '700', color: colors.safe },
  });
}
