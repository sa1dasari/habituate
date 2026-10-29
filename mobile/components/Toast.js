import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '../hooks/useAppTheme';
import { fonts, gradients, radii, shadowLg, spacing } from '../theme';

const AUTO_HIDE_MS = { success: 2600, info: 2600, error: 3800 };

const TYPE_ICON = {
  success: 'check-circle',
  error: 'alert-circle',
  info: 'information',
};

/**
 * A themed bottom snackbar replacing Alert.alert for anything that isn't a
 * real yes/no confirmation — Alert.alert always renders the OS's own native
 * dialog (plain grey Material box on Android, native iOS alert style) in
 * every build including production; it never picks up this app's fonts,
 * colors, or rounded-corner visual language because it isn't actually part
 * of this UI at all.
 *
 * Uses plain RN Animated (not react-native-reanimated) specifically so it
 * never needs a GestureHandlerRootView — unlike NotificationCenterModal's
 * swipe gesture, a fade/slide needs no native gesture recognizer, so it
 * works unmodified inside a RN `<Modal>`'s own surface.
 *
 * Render this once near the end of whichever screen/modal's own JSX calls
 * useToast() — see that hook's comment for why it can't be a single
 * app-root singleton.
 */
export default function Toast({ toast, onHide }) {
  const { colors, typography } = useAppTheme();
  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220, mass: 0.7 }),
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();

    hideTimer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 60, duration: 180, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => onHide());
    }, AUTO_HIDE_MS[toast.type] || AUTO_HIDE_MS.success);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;

  const accentGradient = toast.type === 'error' ? [colors.atRisk, colors.atRisk] : gradients.safe;
  const iconColor = toast.type === 'error' ? colors.atRisk : colors.safe;

  const dismissNow = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => onHide());
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.toast,
          { backgroundColor: colors.surface, transform: [{ translateY }], opacity },
        ]}
      >
        <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.accentBar} />
        <Pressable style={styles.body} onPress={dismissNow} accessibilityRole="alert">
          <MaterialCommunityIcons name={TYPE_ICON[toast.type] || TYPE_ICON.success} size={20} color={iconColor} />
          <Text style={[styles.message, { color: colors.textPrimary, fontFamily: fonts.semiBold }]} numberOfLines={3}>
            {toast.message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 480,
    borderRadius: radii.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    ...shadowLg,
  },
  accentBar: { width: 4 },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  message: { flex: 1, fontSize: 14, lineHeight: 19 },
});
