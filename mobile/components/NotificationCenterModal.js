import React, { useEffect, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '../hooks/useAppTheme';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationSwipePrefs } from '../hooks/useNotificationSwipePrefs';
import { timeAgo } from '../utils/date';
import { radii, shadow, spacing } from '../theme';

const DELETE_ACTION_WIDTH = 76;
const READ_ACTION_WIDTH = 92;
// A full, decisive swipe commits the action directly on release — no button
// to tap afterward. COMMIT_RATIO is how much further than the icon's own
// reveal width the drag has to travel before it counts as "fully swiped"
// rather than just a peek; MAX_RATIO caps how far it can be dragged past
// that, for a bit of resistance feel instead of following the finger forever.
const COMMIT_RATIO = 1.8;
const MAX_RATIO = 2.1;
const SPRING_CONFIG = { damping: 24, stiffness: 320, mass: 0.7 };
const SLIDE_OUT_CONFIG = { damping: 30, stiffness: 260, mass: 0.6 };

const TYPE_ICON = {
  FRIEND_REQUEST_RECEIVED: 'account-plus-outline',
  FRIEND_REQUEST_ACCEPTED: 'account-heart-outline',
  GROUP_JOINED: 'account-group-outline',
  GROUP_CHECKIN: 'check-circle-outline',
  CHALLENGE_INVITE: 'trophy-outline',
  CHALLENGE_JOINED: 'trophy-outline',
  CHALLENGE_CHECKIN: 'trophy-outline',
  NUDGE: 'hand-wave-outline',
  WEEKLY_SUMMARY: 'calendar-week',
  MONTHLY_SUMMARY: 'calendar-month-outline',
  YEARLY_SUMMARY: 'calendar-star',
};

function triggerHaptic(kind) {
  if (kind === 'confirm') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/**
 * The persistent notification center behind the Community page's bell icon —
 * distinct from a push alert (which disappears once dismissed), this reads
 * app_notifications so "X checked in today" or "X accepted your request"
 * stays visible until the user actually looks at it.
 */
export default function NotificationCenterModal({
  visible,
  onClose,
  onOpenGroup,
  onOpenChallenge,
  onOpenInsightsPeriod,
  onOpenFriends,
}) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { notifications, unreadCount, loading, refresh, markRead, markUnread, markAllRead, deleteNotification } =
    useNotifications();
  const { deleteOnLeft } = useNotificationSwipePrefs();

  // Pull-to-refresh already existed, but nothing refetched when the modal
  // itself opens — the same stale-data gap as the challenges/friends/groups
  // modals had. A notification that arrived while this session was already
  // running would otherwise only show up after a manual pull.
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const handlePress = (item) => {
    if (!item.read) markRead(item.id);
    if (item.groupId != null) {
      onClose();
      onOpenGroup?.(item.groupId);
    } else if (item.challengeId != null) {
      onClose();
      onOpenChallenge?.(item.challengeId);
    } else if (
      item.type === 'WEEKLY_SUMMARY' ||
      item.type === 'MONTHLY_SUMMARY' ||
      item.type === 'YEARLY_SUMMARY'
    ) {
      onClose();
      const period =
        item.type === 'WEEKLY_SUMMARY' ? 'weekly' : item.type === 'MONTHLY_SUMMARY' ? 'monthly' : 'yearly';
      onOpenInsightsPeriod?.(period, item.periodStart);
    } else if (item.type === 'FRIEND_REQUEST_RECEIVED' || item.type === 'FRIEND_REQUEST_ACCEPTED') {
      onClose();
      onOpenFriends?.();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* RN's Modal renders in its own native surface, separate from the app's
          root view — the GestureHandlerRootView wrapping App.js doesn't extend
          into it, so GestureDetector's row-swipe had nowhere to attach its
          native handlers to and silently did nothing. Every Modal that uses
          GestureDetector internally needs its own root like this. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <Text style={styles.headerTitle}>Notifications</Text>
          <Pressable
            onPress={markAllRead}
            hitSlop={12}
            style={styles.closeBtn}
            disabled={unreadCount === 0}
            accessibilityLabel="Mark all read"
          >
            <MaterialCommunityIcons
              name="check-all"
              size={22}
              color={unreadCount === 0 ? colors.textMuted : colors.accent}
            />
          </Pressable>
        </View>

        <FlatList
          data={notifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshing={loading}
          onRefresh={refresh}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="bell-outline" size={28} color={colors.textMuted} />
              <Text style={styles.emptyText}>Nothing yet — notifications show up here as friends and groupmates do things.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              styles={styles}
              colors={colors}
              deleteOnLeft={deleteOnLeft}
              onPress={() => handlePress(item)}
              onMarkRead={() => markRead(item.id)}
              onMarkUnread={() => markUnread(item.id)}
              onDelete={() => deleteNotification(item.id)}
            />
          )}
        />
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * Full-swipe-commits, like Gmail/Mail — not reveal-then-tap-to-confirm.
 * Swiping past COMMIT_RATIO×the action's icon width and releasing performs
 * the action immediately; short of that, it springs back to closed. There is
 * no "stays open, tap a button" resting state — the icon+label fade/scale in
 * as you drag purely as feedback, they're not themselves interactive, since
 * the row never settles into a state where tapping one would do anything a
 * continued swipe wouldn't already have done on release.
 *
 * Which direction maps to which action is swappable via
 * useNotificationSwipePrefs (NotificationSettingsScreen) — default is
 * swipe-left-to-read / swipe-right-to-delete, `deleteOnLeft` flips both at
 * once so the two actions never collide on the same side.
 */
function NotificationRow({ item, styles, colors, deleteOnLeft, onPress, onMarkRead, onMarkUnread, onDelete }) {
  // The non-delete side always has an action — never null — so swiping it on
  // an already-read notification undoes that instead of doing nothing.
  const toggleReadAction = item.read ? 'unread' : 'read';

  // rightPanelAction: committed by swiping left (the "right-anchored" panel).
  // leftPanelAction: committed by swiping right (the "left-anchored" panel).
  const rightPanelAction = deleteOnLeft ? 'delete' : toggleReadAction;
  const leftPanelAction = deleteOnLeft ? toggleReadAction : 'delete';

  const negIconWidth = rightPanelAction === 'delete' ? DELETE_ACTION_WIDTH : READ_ACTION_WIDTH;
  const posIconWidth = leftPanelAction === 'delete' ? DELETE_ACTION_WIDTH : READ_ACTION_WIDTH;
  const negMax = negIconWidth * MAX_RATIO;
  const posMax = posIconWidth * MAX_RATIO;
  const negCommit = negIconWidth * COMMIT_RATIO;
  const posCommit = posIconWidth * COMMIT_RATIO;

  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const hapticLatch = useSharedValue(false);

  const commitAction = (action, direction) => {
    triggerHaptic('confirm');
    if (action === 'delete') {
      // Slide fully off in the direction it was swiped — the row disappears
      // from the list once deleteNotification's refresh resolves, but this
      // makes it feel instant regardless of that network round trip.
      translateX.value = withSpring(direction * 600, SLIDE_OUT_CONFIG);
      onDelete();
    } else {
      // The row stays in the list either way (just flips read/unread), so
      // slide back to rest instead of away.
      translateX.value = withSpring(0, SPRING_CONFIG);
      if (action === 'unread') onMarkUnread();
      else onMarkRead();
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const next = startX.value + event.translationX;
      const clamped = Math.max(-negMax, Math.min(posMax, next));
      translateX.value = clamped;

      const pastCommit =
        (clamped < 0 && negCommit > 0 && -clamped >= negCommit) ||
        (clamped > 0 && posCommit > 0 && clamped >= posCommit);
      if (pastCommit && !hapticLatch.value) {
        hapticLatch.value = true;
        runOnJS(triggerHaptic)('reveal');
      } else if (!pastCommit && hapticLatch.value) {
        hapticLatch.value = false;
      }
    })
    .onEnd(() => {
      const current = translateX.value;
      if (current < 0 && negCommit > 0 && -current >= negCommit && rightPanelAction) {
        runOnJS(commitAction)(rightPanelAction, -1);
      } else if (current > 0 && posCommit > 0 && current >= posCommit && leftPanelAction) {
        runOnJS(commitAction)(leftPanelAction, 1);
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Panels grow with the drag (not a fixed width) so the colored background
  // always fills exactly however far the row has been pulled, right up to
  // the commit point — visual feedback for "how close to committing" without
  // a resting, tappable state.
  const leftPanelStyle = useAnimatedStyle(() => ({
    width: Math.max(0, Math.min(translateX.value, posMax)),
  }));
  const rightPanelStyle = useAnimatedStyle(() => ({
    width: Math.max(0, Math.min(-translateX.value, negMax)),
  }));

  // A plain RN `Pressable` nested inside the Pan's GestureDetector races the
  // Pan gesture for the touch via RN's own responder system — the symptom is
  // exactly what it sounds like: a swipe sometimes resolves as a tap instead
  // of revealing the panel. Gesture.Exclusive hands the touch to `pan` first;
  // only once Pan fails to activate does `tap` get a turn — but Tap has NO
  // distance limit by default (only a maxDuration, ~500ms), so a fast swipe
  // could still satisfy Tap's own criteria and win the race regardless of
  // Exclusive's ordering. maxDistance(10) ties Tap's own activation to the
  // same travel threshold as Pan's activeOffsetX, so a real swipe always
  // fails Tap outright instead of merely losing a priority tie-break.
  const tap = Gesture.Tap()
    .maxDistance(10)
    .onEnd(() => {
      runOnJS(onPress)();
    });
  const composedGesture = Gesture.Exclusive(pan, tap);

  return (
    <View style={styles.rowWrapper}>
      {leftPanelAction ? (
        <Animated.View
          style={[
            styles.sidePanel,
            styles.leftPanel,
            { backgroundColor: panelColor(leftPanelAction, colors) },
            leftPanelStyle,
          ]}
        >
          <View style={styles.actionBtn}>
            <ActionGlyph action={leftPanelAction} />
          </View>
        </Animated.View>
      ) : null}

      {rightPanelAction ? (
        <Animated.View
          style={[
            styles.sidePanel,
            styles.rightPanel,
            { backgroundColor: panelColor(rightPanelAction, colors) },
            rightPanelStyle,
          ]}
        >
          <View style={styles.actionBtn}>
            <ActionGlyph action={rightPanelAction} />
          </View>
        </Animated.View>
      ) : null}

      <GestureDetector gesture={composedGesture}>
        <Animated.View style={rowStyle}>
          <View
            style={[styles.row, !item.read && styles.rowUnread]}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <View style={[styles.iconBadge, !item.read && styles.iconBadgeUnread]}>
              <MaterialCommunityIcons
                name={TYPE_ICON[item.type] || 'bell-outline'}
                size={18}
                color={item.read ? colors.textSecondary : colors.accent}
              />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.rowBody} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.rowMeta}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read ? <View style={styles.unreadDot} /> : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function panelColor(action, colors) {
  return action === 'delete' ? colors.atRisk : colors.accent;
}

function ActionGlyph({ action }) {
  if (action === 'delete') {
    return (
      <>
        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFFFFF" />
        <Text style={glyphStyles.text}>Delete</Text>
      </>
    );
  }
  if (action === 'unread') {
    return (
      <>
        <MaterialCommunityIcons name="email-outline" size={18} color="#FFFFFF" />
        <Text style={glyphStyles.text}>Unread</Text>
      </>
    );
  }
  return (
    <>
      <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
      <Text style={glyphStyles.text}>Read</Text>
    </>
  );
}

const glyphStyles = StyleSheet.create({
  text: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
});

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
    list: { padding: spacing.lg, paddingBottom: spacing.xxl },
    rowWrapper: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
    sidePanel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    leftPanel: { left: 0 },
    rightPanel: { right: 0 },
    actionBtn: {
      flex: 1,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: spacing.md,
      ...shadow,
    },
    rowUnread: { backgroundColor: colors.accentSoft },
    iconBadge: {
      width: 34,
      height: 34,
      borderRadius: radii.md,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBadgeUnread: { backgroundColor: '#FFFFFF' },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    rowBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
    rowMeta: { ...typography.meta, marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.accent, marginTop: 4 },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
    emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  });
}
