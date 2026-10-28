import React, { useMemo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii } from '../theme';
import AvatarImage from './AvatarImage';

const AVATAR_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/**
 * Overlapping avatar/initials row with a "+N" overflow bubble — shared between
 * SharedHabitCard and Challenge cards so both participant rows look identical.
 * Pass `onPressPerson(userId)` to make each avatar open the friend-profile viewer —
 * omitted entries (no userId, e.g. a bare string label) render as plain non-interactive
 * views, same as before this was added.
 */
export default function AvatarStack({ people = [], total, max = 4, size = 28, onPressPerson }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors, size), [colors, size]);

  const list = Array.isArray(people) ? people : [];
  const shown = list.slice(0, max);
  const resolvedTotal = total != null ? total : list.length;
  const overflow = resolvedTotal - shown.length;

  return (
    <View style={styles.avatars}>
      {shown.map((person, index) => {
        const label = typeof person === 'string' ? person : person && person.name;
        const photoUrl = typeof person === 'object' && person ? person.photoUrl : null;
        const personUserId = typeof person === 'object' && person ? person.userId : null;
        const Avatar = (
          <View
            style={[
              styles.avatar,
              photoUrl ? styles.avatarPhoto : { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
            ]}
          >
            {photoUrl ? (
              <AvatarImage uri={photoUrl} name={label} size={size} fontSize={11} />
            ) : (
              <Text style={styles.avatarText}>{initials(label)}</Text>
            )}
          </View>
        );
        // The overlap margin has to live on whichever element is the direct flex child of
        // `styles.avatars` (the Pressable wrapper when there is one) — putting it on the inner
        // avatar View instead would leave the Pressable's own box un-shifted, breaking the stack.
        const wrapperStyle = index > 0 ? styles.avatarOverlap : null;

        if (onPressPerson && personUserId) {
          return (
            <Pressable
              key={`${label}-${index}`}
              style={wrapperStyle}
              onPress={() => onPressPerson(personUserId)}
              accessibilityRole="button"
              accessibilityLabel={`View ${label}'s profile`}
              hitSlop={4}
            >
              {Avatar}
            </Pressable>
          );
        }
        return (
          <View key={`${label}-${index}`} style={wrapperStyle}>
            {Avatar}
          </View>
        );
      })}

      {overflow > 0 ? (
        <View style={[styles.avatar, styles.avatarMore, shown.length > 0 ? styles.avatarOverlap : null]}>
          <Text style={styles.avatarMoreText}>+{overflow}</Text>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(colors, size) {
  return StyleSheet.create({
    avatars: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    avatar: {
      width: size,
      height: size,
      borderRadius: radii.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    avatarOverlap: {
      marginLeft: -8,
    },
    avatarPhoto: {
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    avatarText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '700',
    },
    avatarMore: {
      backgroundColor: colors.background,
    },
    avatarMoreText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
