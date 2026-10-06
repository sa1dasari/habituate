import React, { useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

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
 * Renders a profile photo if one loads, falling back to initials — covers
 * both "no photoURL set" and "photoURL set but the image failed to load"
 * (a stale/broken URL otherwise renders as a blank circle with no visible
 * error, since a failed <Image> just shows nothing). `failed` resets
 * whenever `uri` changes, so picking a new photo after a previous failure
 * gets a fresh attempt instead of staying stuck on the fallback.
 */
export default function AvatarImage({ uri, name, size, fontSize = 16, style }) {
  const { colors } = useAppTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
        onError={(e) => {
          if (__DEV__) {
            console.log('[habituate] Avatar photo failed to load:', uri, e.nativeEvent?.error);
          }
          setFailed(true);
        }}
      />
    );
  }

  return <Text style={{ fontSize, fontWeight: '700', color: colors.accent }}>{initials(name)}</Text>;
}
