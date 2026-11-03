import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import AvatarImage from './AvatarImage';
import { timeAgo } from '../utils/date';

const DISMISS_ICON_WIDTH = 84;
// Same full-swipe-commits feel as NotificationCenterModal's NotificationRow —
// swipe either direction past COMMIT_RATIO×the icon width and release to
// dismiss immediately, short of that it springs back. One action on both
// sides here (there's no second action to assign the other side to), unlike
// the notification row's swappable read/delete pair.
const COMMIT_RATIO = 1.8;
const MAX_RATIO = 2.1;
const SPRING_CONFIG = { damping: 24, stiffness: 320, mass: 0.7 };
const SLIDE_OUT_CONFIG = { damping: 30, stiffness: 260, mass: 0.6 };
const COMMIT_WIDTH = DISMISS_ICON_WIDTH * COMMIT_RATIO;
const MAX_WIDTH = DISMISS_ICON_WIDTH * MAX_RATIO;

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function triggerHaptic(kind) {
  if (kind === 'confirm') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * One row in Community's "Recent activity" card — swipe either direction to
 * permanently dismiss it from this viewer's feed (GroupActivityService.dismiss,
 * never deletes the underlying check-in or affects anyone else's feed). The
 * cheer heart stays a plain nested Pressable: unlike NotificationRow, this
 * row has no whole-row tap action to arbitrate against, so the Pan gesture
 * alone is enough — RNGH already lets a tap through to a child touchable
 * whenever Pan fails to activate (movement under activeOffsetX's threshold).
 *
 * `styles` is the parent screen's own makeStyles() output — activityRow,
 * activityAvatar, etc. plus the rowWrapper/sidePanel/dismissGlyph* keys
 * added alongside them, same convention NotificationCenterModal uses for
 * its own row component.
 */
export default function DismissibleActivityRow({ item, styles, colors, avatarColor, onCheer, onDismiss }) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const hapticLatch = useSharedValue(false);

  const commitDismiss = (direction) => {
    triggerHaptic('confirm');
    translateX.value = withSpring(direction * 600, SLIDE_OUT_CONFIG);
    onDismiss();
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const next = startX.value + event.translationX;
      translateX.value = Math.max(-MAX_WIDTH, Math.min(MAX_WIDTH, next));

      const pastCommit = Math.abs(translateX.value) >= COMMIT_WIDTH;
      if (pastCommit && !hapticLatch.value) {
        hapticLatch.value = true;
        runOnJS(triggerHaptic)('reveal');
      } else if (!pastCommit && hapticLatch.value) {
        hapticLatch.value = false;
      }
    })
    .onEnd(() => {
      const current = translateX.value;
      if (Math.abs(current) >= COMMIT_WIDTH) {
        runOnJS(commitDismiss)(current < 0 ? -1 : 1);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const leftPanelStyle = useAnimatedStyle(() => ({ width: Math.max(0, Math.min(translateX.value, MAX_WIDTH)) }));
  const rightPanelStyle = useAnimatedStyle(() => ({ width: Math.max(0, Math.min(-translateX.value, MAX_WIDTH)) }));

  return (
    <View style={styles.rowWrapper}>
      <Animated.View style={[styles.sidePanel, styles.leftPanel, { backgroundColor: colors.atRisk }, leftPanelStyle]}>
        <View style={styles.dismissGlyph}>
          <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
          <Text style={styles.dismissGlyphText}>Dismiss</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.sidePanel, styles.rightPanel, { backgroundColor: colors.atRisk }, rightPanelStyle]}>
        <View style={styles.dismissGlyph}>
          <MaterialCommunityIcons name="close" size={18} color="#FFFFFF" />
          <Text style={styles.dismissGlyphText}>Dismiss</Text>
        </View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          <View style={styles.activityRow}>
            <View
              style={[
                styles.activityAvatar,
                item.userPhotoUrl ? styles.activityAvatarPhoto : { backgroundColor: avatarColor },
              ]}
            >
              {item.userPhotoUrl ? (
                <AvatarImage uri={item.userPhotoUrl} name={item.userName} size={32} fontSize={13} />
              ) : (
                <Text style={styles.activityAvatarText}>{initials(item.userName)}</Text>
              )}
            </View>
            <View style={styles.activityText}>
              <Text style={styles.activityLine} numberOfLines={2}>
                <Text style={styles.activityName}>{item.userName}</Text>{' '}
                {item.value != null && item.value > 1
                  ? `logged ${item.value} for ${item.habitName}`
                  : `completed ${item.habitName}`}
              </Text>
              <Text style={styles.activityMeta}>{timeAgo(item.occurredAt)}</Text>
            </View>
            <Pressable
              style={styles.cheerBtn}
              accessibilityRole="button"
              accessibilityLabel={item.cheeredByMe ? 'Remove cheer' : 'Cheer'}
              onPress={onCheer}
            >
              <MaterialCommunityIcons
                name={item.cheeredByMe ? 'heart' : 'heart-outline'}
                size={18}
                color={item.cheeredByMe ? colors.atRisk : colors.textMuted}
              />
              {item.cheerCount > 0 ? <Text style={styles.cheerCount}>{item.cheerCount}</Text> : null}
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
