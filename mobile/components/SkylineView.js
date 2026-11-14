import React, { useMemo } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg from 'react-native-svg';
import { BASE_Y, STEP, TOWER_W, VIEW_H, X0 } from '../utils/skylineScene';
import SkylineTower from './SkylineTower';
import { fonts } from '../theme';

const LABEL_Y = BASE_Y + 12;
const EMPTY_LOT_SIZE = 40;

/**
 * The horizontally scrolling row of towers. Renders no sky of its own —
 * the sky is a full-page backdrop painted by the screen itself
 * (SkyBackdrop.js, behind everything, not confined to this component's box)
 * so the weather look isn't boxed in behind the towers. Takes an
 * already-built `scene` (from utils/skylineScene.js's buildScene) rather
 * than building one itself — the caller builds it once and can reuse the
 * same hitTargets/labels for an interactive overlay (see
 * SkylineHoldLayer.js) without paying for a second buildScene pass.
 * `habits` is only used here for the tower paint order. `onTowerPress` is
 * optional and unused until Phase 3 wires the tower sheet.
 * `interactiveOverlay` (e.g. SkylineHoldLayer) renders as an extra child
 * INSIDE the same scrolling Svg content — not as an external sibling — so
 * its touch targets scroll in lockstep with the towers instead of staying
 * fixed while the art underneath moves.
 *
 * Also renders a name label under each tower and a trailing "+ New"
 * empty-lot marker (design/skyline/01-skyline.png) — `onAddHabit`,
 * when given, makes that lot tappable.
 */
export default function SkylineView({
  habits,
  scene,
  containerWidth,
  onTowerPress,
  onAddHabit,
  showTouchables = true,
  interactiveOverlay = null,
  theme,
}) {
  const shapesByTower = useMemo(() => {
    const grouped = {};
    scene.shapes.forEach((s) => {
      if (!grouped[s.towerId]) grouped[s.towerId] = [];
      grouped[s.towerId].push(s);
    });
    return grouped;
  }, [scene.shapes]);

  const emptyLotX = X0 + habits.length * STEP;

  return (
    <View style={[styles.root, { width: containerWidth, height: VIEW_H }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}>
        <Svg
          width={scene.width + STEP}
          height={scene.height}
          viewBox={`0 0 ${scene.width + STEP} ${scene.height}`}
        >
          {habits.map((habit) => (
            <SkylineTower key={habit.id} shapes={shapesByTower[habit.id] || []} />
          ))}
        </Svg>
        {habits.map((habit, i) => (
          <Text
            key={`label-${habit.id}`}
            numberOfLines={2}
            ellipsizeMode="tail"
            style={[
              styles.label,
              { color: theme.text, left: X0 + i * STEP - 4, top: LABEL_Y, width: STEP - 8 },
            ]}
          >
            {habit.name}
          </Text>
        ))}
        {showTouchables && scene.hitTargets.map((hit) => {
          // 44dp minimum touch target (CLAUDE.md section 4) — widen a
          // narrow tower's touchable area rather than its drawn width.
          const hitSlopX = Math.max(0, (44 - hit.width) / 2);
          return (
            <Pressable
              key={hit.towerId}
              testID={`skyline-tower-${hit.towerId}`}
              accessibilityRole="button"
              accessibilityLabel={scene.accessibilityLabels[hit.towerId]}
              onPress={onTowerPress ? () => onTowerPress(hit.towerId) : undefined}
              hitSlop={{ left: hitSlopX, right: hitSlopX }}
              style={{
                position: 'absolute',
                left: hit.x,
                top: hit.y,
                width: hit.width,
                height: hit.height,
              }}
            />
          );
        })}
        {interactiveOverlay}
        {onAddHabit && (
          <Pressable
            testID="skyline-empty-lot"
            accessibilityRole="button"
            accessibilityLabel="Lay a foundation for a new habit"
            onPress={onAddHabit}
            style={[
              styles.emptyLot,
              { borderColor: theme.muted, left: emptyLotX, top: BASE_Y - EMPTY_LOT_SIZE },
            ]}
          >
            <MaterialCommunityIcons name="plus" size={20} color={theme.muted} />
          </Pressable>
        )}
        {onAddHabit && (
          <Text
            style={[styles.label, { color: theme.muted, left: emptyLotX - 4, top: LABEL_Y, width: STEP - 8 }]}
          >
            New
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  label: { position: 'absolute', fontFamily: fonts.semiBold, fontSize: 12, lineHeight: 15, textAlign: 'center' },
  emptyLot: {
    position: 'absolute',
    width: EMPTY_LOT_SIZE,
    height: EMPTY_LOT_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
