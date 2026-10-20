import React, { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';
import { useNotifications } from '../hooks/useNotifications';
import { timeAgo } from '../utils/date';
import { radii, shadow, spacing } from '../theme';

const DELETE_ACTION_WIDTH = 76;
const READ_ACTION_WIDTH = 92;

const TYPE_ICON = {
  FRIEND_REQUEST_ACCEPTED: 'account-heart-outline',
  GROUP_JOINED: 'account-group-outline',
  GROUP_CHECKIN: 'check-circle-outline',
  CHALLENGE_INVITE: 'trophy-outline',
  CHALLENGE_CHECKIN: 'trophy-outline',
  NUDGE: 'hand-wave-outline',
};

/**
 * The persistent notification center behind the Community page's bell icon —
 * distinct from a push alert (which disappears once dismissed), this reads
 * app_notifications so "X checked in today" or "X accepted your request"
 * stays visible until the user actually looks at it.
 */
export default function NotificationCenterModal({ visible, onClose, onOpenGroup, onOpenChallenge }) {
  const { colors, typography } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, typography), [colors, typography]);
  const { notifications, unreadCount, loading, refresh, markRead, markAllRead, deleteNotification } =
    useNotifications();

  const handlePress = (item) => {
    if (!item.read) markRead(item.id);
    if (item.groupId != null) {
      onClose();
      onOpenGroup?.(item.groupId);
    } else if (item.challengeId != null) {
      onClose();
      onOpenChallenge?.(item.challengeId);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
              onPress={() => handlePress(item)}
              onMarkRead={() => markRead(item.id)}
              onDelete={() => deleteNotification(item.id)}
            />
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

// Swipe-left reveal: the row slides to expose "Mark as read" (only when
// unread) and "Delete" underneath, instead of needing a long-press menu.
function NotificationRow({ item, styles, colors, onPress, onMarkRead, onDelete }) {
  const actionWidth = (item.read ? 0 : READ_ACTION_WIDTH) + DELETE_ACTION_WIDTH;
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      const next = startX.value + event.translationX;
      translateX.value = Math.max(-actionWidth, Math.min(0, next));
    })
    .onEnd(() => {
      translateX.value = withTiming(translateX.value < -actionWidth / 2 ? -actionWidth : 0);
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const close = () => {
    translateX.value = withTiming(0);
  };

  return (
    <View style={styles.rowWrapper}>
      <View style={styles.actionsRow}>
        {!item.read ? (
          <Pressable
            style={[styles.actionBtn, { width: READ_ACTION_WIDTH, backgroundColor: colors.accent }]}
            onPress={() => {
              onMarkRead();
              close();
            }}
            accessibilityRole="button"
            accessibilityLabel={`Mark "${item.title}" as read`}
          >
            <MaterialCommunityIcons name="check" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Read</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.actionBtn, { width: DELETE_ACTION_WIDTH, backgroundColor: colors.atRisk }]}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete "${item.title}"`}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Delete</Text>
        </Pressable>
      </View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>
          <Pressable
            style={[styles.row, !item.read && styles.rowUnread]}
            onPress={onPress}
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
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
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
    list: { padding: spacing.lg, paddingBottom: spacing.xxl },
    rowWrapper: { marginBottom: spacing.sm, borderRadius: radii.lg, overflow: 'hidden' },
    actionsRow: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    actionBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    actionBtnText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
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
