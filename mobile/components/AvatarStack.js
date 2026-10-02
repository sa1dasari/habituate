import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { radii } from '../theme';

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
 */
export default function AvatarStack({ people = [], total, max = 4, size = 28 }) {
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
        return (
          <View
            key={`${label}-${index}`}
            style={[
              styles.avatar,
              { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
              index > 0 ? styles.avatarOverlap : null,
            ]}
          >
            <Text style={styles.avatarText}>{initials(label)}</Text>
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
