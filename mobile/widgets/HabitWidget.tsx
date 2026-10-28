import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { lightColors } from '../theme';

/**
 * Android home-screen widget (SKILLS.md Phase 7 "Home-screen widget for
 * quick check-in"), built with `react-native-android-widget` — this
 * renders real native `RemoteViews` under the hood, not a WebView, and
 * supports Android's standard resizable widget grid out of the box (the
 * host launcher decides the actual cell size; we just branch on the
 * `width`/`height` (dp) Android reports us for that instance).
 *
 * Styling note: `react-native-android-widget` only supports a constrained
 * flexbox/RemoteViews subset of RN styling (no gradients, no custom
 * fonts/Nunito, no shadows) — this is the platform's own limit, not a
 * shortcut taken here. Colors are pulled from `theme.js`'s *light* palette
 * only (`lightColors`), since Android widgets don't get app-level dark-mode
 * context the way in-app screens do via `useAppTheme()`; they follow the
 * *launcher's* theme, which this library doesn't currently expose a hook
 * for — a documented, deliberate simplification, not a dark-mode regression
 * of the in-app rule in CLAUDE.md (that rule governs React Native screens).
 *
 * Size classes (Android doesn't have iOS's fixed small/medium/large
 * presets — it's a continuous resizable grid, so these are *our* bucket
 * choices at the widget library's recommended breakpoints):
 * - width < 180dp: single most-relevant habit, name + one tap target.
 * - 180–250dp and/or 2+ rows: up to 3 habits in a short list.
 * - wider/taller: up to 5 habits, each with its current streak.
 */

const EMPTY_COPY = "You're all caught up today.";

function HabitRow({ habit, compact }: { habit: any; compact?: boolean }) {
  const dotColor = habit.checkedInToday ? lightColors.safe : habit.color || lightColors.accent;
  return (
    <FlexWidget
      clickAction={habit.checkedInToday ? undefined : 'CHECK_IN'}
      clickActionData={{ habitId: String(habit.id) }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        width: 'match_parent',
        paddingVertical: 6,
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
      <TextWidget
        text={habit.name}
        style={{
          fontSize: compact ? 13 : 14,
          color: lightColors.textPrimary,
          flex: 1,
        }}
        maxLines={1}
      />
      {!compact && habit.currentStreak > 0 ? (
        <TextWidget
          text={`${habit.currentStreak}\u{1F525}`}
          style={{ fontSize: 12, color: lightColors.textSecondary, marginLeft: 6 }}
        />
      ) : null}
      <TextWidget
        text={habit.checkedInToday ? '✓' : '+'}
        style={{
          fontSize: 16,
          color: habit.checkedInToday ? lightColors.safe : lightColors.accent,
          marginLeft: 8,
          fontWeight: 'bold',
        }}
      />
    </FlexWidget>
  );
}

export function HabitWidget(props: any) {
  const width = props?.width ?? 180;
  const height = props?.height ?? 110;
  const snapshot: any[] = props?.snapshot || [];
  const notDone = snapshot.filter((h) => !h.checkedInToday);
  const ranked = [...notDone, ...snapshot.filter((h) => h.checkedInToday)];

  if (ranked.length === 0) {
    return (
      <FlexWidget
        style={{
          height: 'match_parent',
          width: 'match_parent',
          backgroundColor: lightColors.surface,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
        clickAction="OPEN_APP"
      >
        <TextWidget
          text={EMPTY_COPY}
          style={{ fontSize: 13, color: lightColors.textSecondary, textAlign: 'center' }}
        />
      </FlexWidget>
    );
  }

  const isSmall = width < 180;
  const maxRows = isSmall ? 1 : height > 180 ? 5 : 3;
  const visible = ranked.slice(0, maxRows);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: lightColors.surface,
        borderRadius: 16,
        flexDirection: 'column',
        paddingVertical: 8,
      }}
    >
      {!isSmall ? (
        <TextWidget
          text="Due today"
          style={{
            fontSize: 11,
            color: lightColors.textMuted,
            marginLeft: 10,
            marginBottom: 2,
          }}
        />
      ) : null}
      {visible.map((habit) => (
        <HabitRow key={habit.id} habit={habit} compact={isSmall} />
      ))}
    </FlexWidget>
  );
}

export default HabitWidget;
