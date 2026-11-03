import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { lightColors as lightColorsUntyped, darkColors as darkColorsUntyped } from '../theme';

// theme.js is plain JS, so its exports have no literal type — every value here
// genuinely is a '#RRGGBB' string, but TS infers `string`, which doesn't satisfy
// react-native-android-widget's `ColorProp` (`` `#${string}` | `rgba(...)` ``)
// template-literal type. One honest re-cast here fixes every call site below.
type Palette = Record<string, `#${string}`>;
export const lightColors = lightColorsUntyped as Palette;
export const darkColors = darkColorsUntyped as Palette;

/**
 * Android home-screen widget (SKILLS.md Phase 7 "Home-screen widget for
 * quick check-in"), built with `react-native-android-widget` — this renders
 * real native `RemoteViews` under the hood, not a WebView, and supports
 * Android's standard resizable widget grid (the host launcher decides the
 * actual cell size; this just branches on the `width`/`height` (dp) Android
 * reports for that instance).
 *
 * Styling note: `react-native-android-widget` only supports a constrained
 * flexbox/RemoteViews subset of RN styling (no gradients, no custom
 * fonts/Nunito, no shadows) — a platform limit, not a shortcut taken here.
 *
 * Dark mode: the library DOES support this — `requestWidgetUpdate`'s
 * `renderWidget` and the task handler's `renderWidget()` both accept either
 * a single tree or `{ light, dark }`, and Android picks the matching one at
 * *display* time (no re-render, confirmed against the library's own native
 * source: `layout-night/rn_widget.xml` swaps which bitmap ImageView is
 * visible). See `widgets/widgetTaskHandler.js` and `utils/widgetSync.js` for
 * where both variants get built and returned.
 *
 * CRITICAL CONSTRAINT: the library computes each clickable region's
 * on-screen position from the LIGHT tree ONLY (`getClickableViews()` is
 * built once, off the light RemoteViews) — the dark tree is rasterized to a
 * bitmap and never measured for taps. So light and dark must be
 * pixel-identical in structure/size/position, differing ONLY in color.
 * `colors` below may only ever affect a `backgroundColor`/`color` prop —
 * NEVER which elements render, their size, or their layout. Every branch in
 * this file is on `snapshot`/`width`/`height`, never on `colors`.
 */

// Hand-tuned floor, not a measured value — the library's own tap-target
// geometry can drift slightly from what's drawn as rows shrink (see the
// file-level doc comment), so this stays a fixed, generous constant rather
// than something computed to pack in the maximum theoretical row count.
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 22;
const WIDE_WIDTH = 200; // below this, a row drops its secondary (cadence/streak) line
// Must match the list container's own paddingVertical below (top + bottom) —
// kept as one constant so the row-count math can't silently drift from the
// actual layout and clip/misplace the last row's tap target.
const CONTAINER_VERTICAL_PADDING = 16;

const NO_HABITS_COPY = 'No habits yet — add one in Habituate to see it here.';

function HabitRow({
  habit,
  colors,
  showSecondary,
}: {
  habit: any;
  colors: Palette;
  showSecondary: boolean;
}) {
  const dotColor = habit.done ? colors.safe : habit.color || colors.accent;
  // A done habit has nothing left to check in — tapping it instead opens
  // that habit's own Insights detail (WidgetDeepLinkBridge in App.js).
  const clickAction = habit.done ? 'OPEN_HABIT' : 'CHECK_IN';
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={{ habitId: String(habit.id) }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: 'match_parent',
        height: ROW_HEIGHT,
        paddingHorizontal: 10,
      }}
    >
      <FlexWidget
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotColor,
          marginRight: 10,
        }}
      />
      <FlexWidget style={{ flexDirection: 'column', flex: 1 }}>
        <TextWidget text={habit.name} style={{ fontSize: 14, color: colors.textPrimary }} maxLines={1} />
        {showSecondary && habit.cadenceLabel ? (
          <TextWidget
            text={`${habit.cadenceLabel} · ${habit.periodDone}/${habit.periodTarget}`}
            style={{ fontSize: 10, color: colors.textMuted }}
          />
        ) : null}
      </FlexWidget>
      {showSecondary && habit.currentStreak > 0 ? (
        <TextWidget
          text={`${habit.currentStreak}\u{1F525}`}
          style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}
        />
      ) : null}
      <TextWidget
        text={habit.done ? '✓' : '+'}
        style={{
          fontSize: 16,
          color: habit.done ? colors.safe : colors.accent,
          marginLeft: 8,
          fontWeight: 'bold',
        }}
      />
    </FlexWidget>
  );
}

/** Used whenever exactly one habit is on screen — either the account only has
 * one, or the widget is sized too small to show more than one — so the box
 * isn't left mostly empty around a single skinny line. */
function HeroCard({ habit, colors }: { habit: any; colors: Palette }) {
  const progressText = habit.isDaily
    ? habit.done
      ? 'Done for today'
      : 'Not done yet today'
    : habit.cadenceLabel
      ? `${habit.periodDone}/${habit.periodTarget} this ${habit.cadenceLabel.toLowerCase()}`
      : habit.done
        ? 'Done for this period'
        : 'Not done yet';
  // Anti-guilt framing (CLAUDE.md): never "0-day streak," invite the start instead.
  const streakText = habit.currentStreak > 0 ? `${habit.currentStreak}\u{1F525} day streak` : 'Start a streak today';
  const clickAction = habit.done ? 'OPEN_HABIT' : 'CHECK_IN';

  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={{ habitId: String(habit.id) }}
      style={{
        flexDirection: 'column',
        width: 'match_parent',
        height: 'match_parent',
        justifyContent: 'center',
        paddingHorizontal: 16,
      }}
    >
      <TextWidget text={habit.name} style={{ fontSize: 18, color: colors.textPrimary, fontWeight: 'bold' }} maxLines={2} />
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <TextWidget text={streakText} style={{ fontSize: 13, color: colors.textSecondary }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <TextWidget
          text={progressText}
          style={{ fontSize: 12, color: habit.done ? colors.safe : colors.textMuted }}
        />
      </FlexWidget>
      <FlexWidget
        style={{
          marginTop: 14,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: habit.done ? colors.safeSoft : colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TextWidget
          text={habit.done ? '✓' : '+'}
          style={{ fontSize: 20, color: habit.done ? colors.safe : colors.accent, fontWeight: 'bold' }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

export function HabitWidget(props: any) {
  const width = props?.width ?? 150;
  const height = props?.height ?? 150;
  const colors: Palette = props?.colors ?? lightColors;
  const snapshot: any[] = props?.snapshot || [];
  const notDone = snapshot.filter((h) => !h.done);
  const ranked = [...notDone, ...snapshot.filter((h) => h.done)];
  const dueTodayItems = snapshot.filter((h) => h.isDaily);
  const dueTodayDone = dueTodayItems.filter((h) => h.done).length;

  if (ranked.length === 0) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: colors.surface,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget text={NO_HABITS_COPY} style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center' }} />
      </FlexWidget>
    );
  }

  // A single habit (the whole account has only one, or there's only room
  // for one) gets the dense hero layout instead of one skinny row lost in
  // a mostly-empty box.
  if (ranked.length === 1) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: colors.surface,
          borderRadius: 16,
        }}
      >
        <HeroCard habit={ranked[0]} colors={colors} />
      </FlexWidget>
    );
  }

  const showSecondary = width >= WIDE_WIDTH;
  const showHeader = height >= HEADER_HEIGHT + CONTAINER_VERTICAL_PADDING + ROW_HEIGHT * 2;
  const availableForRows = height - CONTAINER_VERTICAL_PADDING - (showHeader ? HEADER_HEIGHT : 0);
  const rows = Math.max(1, Math.floor(availableForRows / ROW_HEIGHT));
  const visible = ranked.slice(0, Math.min(rows, ranked.length));

  // Rows fit but there's really only one habit actually on screen after all
  // (e.g. a very short, wide widget) — same reasoning as the ranked.length
  // === 1 branch above, just reached a different way.
  if (visible.length === 1) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: colors.surface,
          borderRadius: 16,
        }}
      >
        <HeroCard habit={visible[0]} colors={colors} />
      </FlexWidget>
    );
  }

  return (
    // No clickAction on this root — the library adds each child's clickable
    // overlay before the root's (children-first, root-last collection
    // order), so a root-level click here would sit on TOP of every row's
    // overlay and swallow all row taps. Only individual rows are clickable;
    // there's deliberately no "tap blank space to open the app" affordance
    // in this layout, unlike the empty-state and hero layouts below, which
    // have no clickable children to conflict with.
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: colors.surface,
        borderRadius: 16,
        flexDirection: 'column',
        paddingVertical: CONTAINER_VERTICAL_PADDING / 2,
      }}
    >
      {showHeader ? (
        <TextWidget
          text={dueTodayItems.length > 0 ? `${dueTodayDone} of ${dueTodayItems.length} due today` : 'Your habits'}
          style={{ fontSize: 11, color: colors.textMuted, marginLeft: 10, marginBottom: 2 }}
        />
      ) : null}
      {visible.map((habit) => (
        <HabitRow key={habit.id} habit={habit} colors={colors} showSecondary={showSecondary} />
      ))}
    </FlexWidget>
  );
}

export default HabitWidget;
