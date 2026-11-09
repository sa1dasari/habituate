import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg from 'react-native-svg';
import { VIEW_H } from '../utils/skylineScene';
import SkylineTower from './SkylineTower';
import SkyBackdrop from './SkyBackdrop';

/**
 * Composes the sky backdrop (fixed, does not scroll) with the horizontally
 * scrolling row of towers. Takes an already-built `scene` (from
 * utils/skylineScene.js's buildScene) rather than building one itself — the
 * caller builds it once and can reuse the same hitTargets/labels for an
 * interactive overlay (see SkylineHoldLayer.js) without paying for a second
 * buildScene pass. `habits` is only used here for the tower paint order.
 * `onTowerPress` is optional and unused until Phase 3 wires the tower sheet.
 * `interactiveOverlay` (e.g. SkylineHoldLayer) renders as an extra child
 * INSIDE the same scrolling Svg content — not as an external sibling — so
 * its touch targets scroll in lockstep with the towers instead of staying
 * fixed while the art underneath moves.
 */
export default function SkylineView({
  habits,
  scene,
  skyStops,
  containerWidth,
  onTowerPress,
  showTouchables = true,
  interactiveOverlay = null,
}) {
  const shapesByTower = useMemo(() => {
    const grouped = {};
    scene.shapes.forEach((s) => {
      if (!grouped[s.towerId]) grouped[s.towerId] = [];
      grouped[s.towerId].push(s);
    });
    return grouped;
  }, [scene.shapes]);

  return (
    <View style={[styles.root, { width: containerWidth, height: VIEW_H }]}>
      <View style={StyleSheet.absoluteFill}>
        <SkyBackdrop stops={skyStops} width={containerWidth} height={VIEW_H} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={StyleSheet.absoluteFill}>
        <Svg width={scene.width} height={scene.height} viewBox={`0 0 ${scene.width} ${scene.height}`}>
          {habits.map((habit) => (
            <SkylineTower key={habit.id} shapes={shapesByTower[habit.id] || []} />
          ))}
        </Svg>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
});
