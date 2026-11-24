import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { G, Rect } from 'react-native-svg';
import SkyBackdrop from './SkyBackdrop';
import SkylineTower from './SkylineTower';
import AvatarImage from './AvatarImage';
import { useWeatherSky } from '../hooks/useWeatherSky';
import { skyKind } from '../utils/sky';
import { buildScene } from '../utils/skylineScene';
import { buildShareSceneHabit, buildShareSkylineHabits } from '../utils/shareCard';
import { buildCategoryTowerColors, fonts, skyGradients, skylineTowerTheme, skylineUI, spacing, radii } from '../theme';
import { HABIT_CATEGORY_COLORS } from '../constants/habitCategories';

const categoryColors = buildCategoryTowerColors(HABIT_CATEGORY_COLORS);

// Board 80/81 export sizes, scaled down to a comfortable on-screen/capture
// size — react-native-view-shot captures at the view's own rendered size
// (times device pixel ratio), not these exact pixel counts; this repo's
// existing MyStatsModal.js share card does the same, not forcing an exact
// output resolution.
const SQUARE = { width: 320, height: 320 };
const STORY = { width: 320, height: 569 }; // 320 * 16/9

// Lifecycle shapes (crane mast, topped-out flag, monument hatch) are a
// mid-construction/retired signal that doesn't belong on a celebratory share
// snapshot — board 80/81 show a plain flat cap. Filtered out by id suffix
// rather than inventing a 4th buildScene state just for this one caller.
function stripLifecycleShapes(shapes) {
  return shapes.filter((s) => !s.id.endsWith('-crane') && !s.id.endsWith('-flag') && !s.id.includes('-monument-'));
}

// Boards 80/81 show the tower standing on a dim, distant city silhouette —
// the same atmospheric context as the Skyline tab's own background, not the
// user's other real towers. There's no scene-engine primitive for this (it's
// pure backdrop, never a hit target), so it's a small fixed decorative set
// rendered behind the real tower, anchored to the same ground line.
const CITY_SILHOUETTE = [
  { dx: -170, w: 30, h: 56 },
  { dx: -124, w: 24, h: 92 },
  { dx: -80, w: 34, h: 40 },
  { dx: 58, w: 26, h: 70 },
  { dx: 96, w: 32, h: 46 },
  { dx: 140, w: 22, h: 86 },
  { dx: 172, w: 28, h: 52 },
];
const CITY_SILHOUETTE_COLOR = '#1E2636';

function CityBackdrop({ centerX, groundY }) {
  return (
    <G opacity={0.6}>
      {CITY_SILHOUETTE.map((b, i) => (
        <Rect key={i} x={centerX + b.dx - b.w / 2} y={groundY - b.h} width={b.w} height={b.h} fill={CITY_SILHOUETTE_COLOR} />
      ))}
    </G>
  );
}

/**
 * The actual shareable artwork (boards 80/81/83/84) for either a single
 * tower (`subject="tower"`, default — pass `habit`) or the whole skyline
 * (`subject="skyline"` — pass `habits`, the full active daily-habit list).
 * Reuses buildScene/SkylineTower on synthesized gap-free runs
 * (utils/shareCard.js) so this matches the in-app towers' real rendering
 * (window pips, best-run ledge) rather than a hand-drawn approximation, and
 * follows the Skyline tab's own sky/weather rule rather than a fixed
 * "always night" sky.
 */
export default function ShareCard({
  habit,
  habits,
  subject = 'tower',
  format = 'square',
  showUsername = true,
  username,
  avatarUri,
  mode = 'dark',
}) {
  const { weatherCode, sunrise, sunset } = useWeatherSky();
  const towerTheme = skylineTowerTheme[mode];
  const ui = skylineUI[mode];
  const dims = format === 'story' ? STORY : SQUARE;
  const isSkyline = subject === 'skyline';
  const styles = useMemo(() => makeStyles(ui, dims), [ui, dims]);

  const today = useMemo(() => new Date(), []);
  const currentSkyKind = useMemo(() => skyKind({ now: today, sunrise, sunset, weatherCode }), [today, sunrise, sunset, weatherCode]);
  const skyStops = skyGradients[mode][currentSkyKind];

  const empty = { shapes: [], crop: null, cityCenterX: 0, cityGroundY: 0 };

  const { shapes, crop, cityCenterX, cityGroundY, run, floors } = useMemo(() => {
    if (isSkyline) {
      const { sceneHabits, towersStanding, bestRun, floorsBuilt } = buildShareSkylineHabits(
        habits,
        categoryColors[mode],
        mode,
        today,
      );
      if (!sceneHabits.length) return { ...empty, run: 0, floors: 0 };
      const scene = buildScene(sceneHabits, { today, theme: towerTheme });
      const targets = scene.hitTargets;
      const topPad = 20;
      const groundPad = 16;
      const sidePad = format === 'story' ? 60 : 30;
      const minX = Math.min(...targets.map((t) => t.x));
      const maxX = Math.max(...targets.map((t) => t.x + t.width));
      const minY = Math.min(...targets.map((t) => t.y));
      const maxY = Math.max(...targets.map((t) => t.y + t.height));
      return {
        shapes: stripLifecycleShapes(scene.shapes),
        crop: {
          x: minX - sidePad,
          y: minY - topPad,
          width: maxX - minX + sidePad * 2,
          height: maxY - minY + topPad + groundPad,
        },
        cityCenterX: (minX + maxX) / 2,
        cityGroundY: maxY,
        run: bestRun,
        floors: floorsBuilt,
        towersStanding,
      };
    }
    if (!habit) return { ...empty, run: 0, floors: 0 };
    const sceneHabit = buildShareSceneHabit(habit, categoryColors[mode], mode, today);
    const scene = buildScene([sceneHabit], { today, theme: towerTheme });
    const target = scene.hitTargets[0];
    if (!target) return { ...empty, shapes: stripLifecycleShapes(scene.shapes), run: 0, floors: 0 };
    const topPad = 20;
    const groundPad = 16;
    const sidePad = format === 'story' ? 90 : 140;
    const centerX = target.x + target.width / 2;
    const groundY = target.y + target.height;
    return {
      shapes: stripLifecycleShapes(scene.shapes),
      crop: {
        x: centerX - target.width / 2 - sidePad,
        y: target.y - topPad,
        width: target.width + sidePad * 2,
        height: target.height + topPad + groundPad,
      },
      cityCenterX: centerX,
      cityGroundY: groundY,
      run: habit?.streak ?? habit?.currentRun ?? 0,
      floors: (habit?.checkIns || []).length,
    };
  }, [isSkyline, habit, habits, mode, today, towerTheme, format]);

  const towersStanding = isSkyline ? (habits || []).length : 0;

  return (
    <View style={[styles.card, format === 'story' ? styles.cardStory : styles.cardSquare]}>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={dims.width} height={dims.height} viewBox={`0 0 ${dims.width} ${dims.height}`}>
          <SkyBackdrop stops={skyStops} kind={currentSkyKind} width={dims.width} height={dims.height} />
        </Svg>
      </View>

      {crop ? (
        <View
          style={
            format === 'story'
              ? styles.towerWrapStory
              : isSkyline
                ? styles.towerWrapSquareSkyline
                : styles.towerWrapSquare
          }
        >
          <Svg width="100%" height="100%" viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}>
            <CityBackdrop centerX={cityCenterX} groundY={cityGroundY} />
            <G>
              <SkylineTower shapes={shapes} />
            </G>
          </Svg>
        </View>
      ) : null}

      <View
        style={
          format === 'story' ? styles.chipStory : isSkyline ? styles.chipSquareSkyline : styles.chipSquare
        }
      >
        <Text style={styles.eyebrow}>{isSkyline ? 'SKYLINE' : 'TOWER'}</Text>
        <Text style={styles.habitName} numberOfLines={2}>
          {isSkyline ? `${towersStanding} tower${towersStanding === 1 ? '' : 's'} standing` : habit?.name || ''}
        </Text>
        <View style={styles.runRow}>
          <Text style={styles.runNumber}>{run}</Text>
          <Text style={styles.runWord}>{isSkyline ? ' day best run' : ' day run'}</Text>
        </View>
        {format === 'square' ? <Text style={styles.floorsLine}>{floors} floor{floors === 1 ? '' : 's'} built</Text> : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {showUsername ? (
            <>
              <AvatarImage uri={avatarUri} name={username} size={22} fontSize={11} />
              <Text style={styles.footerText}>@{username}</Text>
            </>
          ) : null}
        </View>
        <View style={styles.footerRight}>
          <MaterialCommunityIcons name="office-building" size={14} color={ui.amber} />
          <Text style={styles.wordmark}>Habituate</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(ui, dims) {
  return StyleSheet.create({
    card: {
      width: dims.width,
      height: dims.height,
      borderRadius: radii.lg,
      overflow: 'hidden',
      backgroundColor: ui.background,
    },
    cardSquare: {},
    cardStory: {},
    towerWrapSquare: {
      position: 'absolute',
      left: 0,
      bottom: 44,
      width: dims.width * 0.66,
      height: dims.height * 0.78,
    },
    towerWrapStory: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 60,
      width: '100%',
      height: dims.height * 0.5,
    },
    // Board 83: the whole-skyline card spans several towers side by side
    // across the full width, so (unlike the single-tower square layout) the
    // chip sits top-left clear of the art, rather than beside it.
    towerWrapSquareSkyline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 44,
      width: '100%',
      height: dims.height * 0.55,
    },
    chipSquareSkyline: {
      position: 'absolute',
      top: dims.height * 0.1,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(10,12,20,0.82)',
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    chipSquare: {
      position: 'absolute',
      right: 20,
      top: dims.height * 0.19,
      left: dims.width * 0.46,
      backgroundColor: 'rgba(10,12,20,0.82)',
      borderRadius: radii.lg,
      padding: spacing.md,
    },
    chipStory: {
      position: 'absolute',
      top: dims.height * 0.14,
      left: 20,
      right: 20,
      backgroundColor: 'rgba(10,12,20,0.82)',
      borderRadius: radii.lg,
      padding: spacing.md,
      alignItems: 'center',
    },
    eyebrow: {
      fontFamily: fonts.extraBold,
      fontSize: 10,
      letterSpacing: 1,
      color: ui.muted,
    },
    habitName: {
      fontFamily: fonts.extraBold,
      fontSize: 18,
      color: ui.text,
      marginTop: 2,
    },
    runRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.sm },
    runNumber: { fontFamily: fonts.extraBold, fontSize: 24, color: ui.text },
    runWord: { fontFamily: fonts.semiBold, fontSize: 13, color: ui.text },
    floorsLine: { fontFamily: fonts.regular, fontSize: 11, color: ui.muted, marginTop: 2 },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 44,
      backgroundColor: ui.background,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
    },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    footerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    footerText: { fontFamily: fonts.semiBold, fontSize: 12, color: ui.text },
    wordmark: { fontFamily: fonts.extraBold, fontSize: 12, color: ui.text },
  });
}
