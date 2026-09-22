import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing, typography } from '../theme';

const VARIANT = {
  checkin: { icon: 'star-four-points', duration: 2800 },
  milestone: { icon: 'trophy', duration: 4200 },
};

/**
 * Big centered card shown on every check-in (progress + streak) and, more
 * emphatically, when a habit or goal's period target is actually hit. Auto-
 * dismisses so rapid successive check-ins (e.g. tapping +1 several times on
 * a count habit) never stack up requiring a manual close each time — Close
 * and Share are there for whoever wants to act sooner.
 */
export default function CheckInCelebration({ payload, onDismiss }) {
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!payload) return undefined;

    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    const { duration } = VARIANT[payload.variant] || VARIANT.checkin;
    const timer = setTimeout(() => close(), duration);
    return () => clearTimeout(timer);

    function close() {
      Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => {
        if (dismissRef.current) dismissRef.current();
      });
    }
  }, [payload, scale, opacity]);

  if (!payload) return null;

  const { icon } = VARIANT[payload.variant] || VARIANT.checkin;
  const isMilestone = payload.variant === 'milestone';

  const handleShare = () => {
    Share.share({ message: payload.shareText }).catch(() => {});
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Animated.View
          style={[styles.cardWrap, { opacity, transform: [{ scale }] }]}
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <Pressable
              style={styles.closeBtn}
              onPress={onDismiss}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={[styles.iconCircle, isMilestone && styles.iconCircleMilestone]}>
              <MaterialCommunityIcons
                name={icon}
                size={30}
                color={isMilestone ? colors.warning : colors.safe}
              />
            </View>

            <Text style={styles.headline}>{payload.headline}</Text>
            {payload.subhead ? <Text style={styles.subhead}>{payload.subhead}</Text> : null}

            {payload.progressLine ? <Text style={styles.line}>{payload.progressLine}</Text> : null}

            {payload.streakLine ? (
              <View style={styles.streakRow}>
                <MaterialCommunityIcons name="fire" size={16} color={colors.flame} />
                <Text style={styles.streakText}>{payload.streakLine}</Text>
              </View>
            ) : null}

            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <MaterialCommunityIcons name="share-variant-outline" size={16} color="#FFFFFF" />
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 340,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg + 6,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl + spacing.sm,
    alignItems: 'center',
    ...shadow,
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.safeSoft,
    marginBottom: spacing.md,
  },
  iconCircleMilestone: {
    backgroundColor: colors.warningSoft,
  },
  headline: {
    ...typography.screenTitle,
    fontSize: 22,
    textAlign: 'center',
  },
  subhead: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  line: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  streakText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.lg,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
