import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing } from '../theme';

/**
 * Celebration banner shown after a check-in. It only ever appears on a
 * positive action — undoing a check-in is silent, so the app never comments
 * on a habit being un-done.
 */
export default function MotivationBanner({ message, onDismiss, duration = 2600 }) {
  const progress = useRef(new Animated.Value(0)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!message) return undefined;

    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(progress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (dismissRef.current) dismissRef.current();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, progress]);

  if (!message) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrapper, { opacity: progress, transform: [{ translateY }] }]}
    >
      <Pressable
        style={styles.banner}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={message}
      >
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="star-four-points" size={16} color={colors.safe} />
        </View>
        <Text style={styles.text}>{message}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.safeSoft,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    ...shadow,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.safeSoft,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
