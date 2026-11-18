import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import FriendTowerGraphic from './FriendTowerGraphic';
import { skylineTowerTheme } from '../theme';
import { fonts, spacing } from '../theme';

// Same ad hoc per-member colour set AvatarStack.js/SharedHabitDetailModal.js
// already assign avatars from (index-based, stable regardless of any later
// re-sort) — kept local here rather than a new shared constant, matching how
// those two files each already carry their own copy.
const MEMBER_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#DB2777', '#EA580C'];
const MAX_TOWERS = 6;

/**
 * Boards 08/10: a row of member towers joined by dashed skybridges — one
 * tower per cooperative-group member, each a solid per-member colour (no
 * TOWER_COLOR_PALETTE key exists per participant; GroupResponse.Participant
 * only carries currentStreak/checkedInToday, not a floor count the way
 * FriendProfileResponse.FriendTower does for a friend's own tower).
 *
 * KNOWN SIMPLIFICATION, not a full silhouette: a member's tower is drawn at
 * exactly their currentStreak height, every floor lit — this is deliberately
 * the run only, with any older/un-lit history above it (what board 08's own
 * towers show for a lapsed member) omitted, because GroupResponse has no
 * floor count to draw it with. Extending the backend to carry one (the way
 * FriendProfileResponse already does) would let this match the board
 * exactly; flagged here rather than silently shipped as if it were complete.
 *
 * Always the dark tower palette regardless of app theme mode, same reasoning
 * as FriendTowerGraphic's own callers: these are saturated, board-matching
 * hues picked to read clearly, not the light-mode contrast-adjusted set.
 */
export default function MemberTowerRow({ members = [], connectorColor, showLabels = false, isSelf, towerWidth = 70, height = 150 }) {
  const towerTheme = skylineTowerTheme.dark;
  const shown = Array.isArray(members) ? members.slice(0, MAX_TOWERS) : [];
  // 4 towers at the caller's requested width is what the boards show fitting
  // a card/strip without scrolling — beyond that, shrink per-tower width
  // proportionally (floor 40px, below which a tower reads as a sliver) so a
  // full 6-member row doesn't overflow or clip; ScrollView below is the
  // fallback once even the floor width doesn't fit a narrow device.
  const effectiveWidth = shown.length > 4 ? Math.max(40, Math.round(towerWidth * (4 / shown.length))) : towerWidth;
  // Anchor the connector to the towers' own ground line (FriendTowerGraphic's
  // baseY = height - 4), not centered in the row's full cross-axis height —
  // alignSelf:'center' previously centered it against the tallest sibling's
  // total box (SVG height, plus the label block when showLabels is true),
  // which floats the "skybridge" in empty space above anything shorter than
  // a near-maximal tower instead of visibly joining the two towers. The
  // label reserve mirrors styles.label's rendered block (fontSize 13 line
  // height + marginTop).
  const labelReserve = showLabels ? 22 : 0;
  const connectorMarginBottom = labelReserve + 4;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {shown.map((member, index) => {
        const streak = Math.max(0, Math.floor(member?.currentStreak || 0));
        const tower = { color: null, floorCount: streak, currentRun: streak, closedSegmentFloorCounts: [] };
        const label = member?.name || 'Member';
        const self = typeof isSelf === 'function' ? isSelf(member) : false;
        const runWord = streak === 1 ? 'day' : 'days';
        return (
          <React.Fragment key={member?.userId || `${label}-${index}`}>
            {index > 0 ? (
              <View
                style={[styles.connector, { backgroundColor: connectorColor, marginBottom: connectorMarginBottom }]}
                testID="member-tower-connector"
              />
            ) : null}
            <View style={styles.towerCol}>
              <FriendTowerGraphic
                tower={tower}
                mode="dark"
                towerTheme={towerTheme}
                colorHex={MEMBER_COLORS[index % MEMBER_COLORS.length]}
                width={effectiveWidth}
                height={height}
                testID={`member-tower-${index}`}
                accessibilityLabel={`${self ? 'You' : label}, tower, ${streak} ${runWord} run`}
              />
              {showLabels ? (
                <Text style={styles.label} numberOfLines={1}>
                  {self ? 'You' : label}
                </Text>
              ) : null}
            </View>
          </React.Fragment>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  towerCol: { alignItems: 'center' },
  connector: {
    height: 3,
    width: 16,
    alignSelf: 'flex-end',
    borderRadius: 2,
  },
  // Always white: `showLabels` is only ever true over a dark sky backdrop
  // (SharedHabitDetailModal's board-10 hero), never the plain card surface
  // (board 08's thumbnail row passes showLabels=false), so this never needs
  // to vary with the app's own light/dark mode.
  label: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
});
