import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../hooks/useAppTheme';
import {
  FLOATING_BAR_BOTTOM_MARGIN,
  FLOATING_BAR_HEIGHT,
  FLOATING_BAR_RADIUS,
  FLOATING_BAR_SIDE_MARGIN,
  useFloatingTabBar,
} from '../hooks/useFloatingTabBar';
import { fonts } from '../theme';

const DOCKED_HEIGHT = 58;

// Board 101: plain translucent fill, no blur, no new dependency — exact
// rgba values from the owner-approved spec, not theme tokens, since these
// are specific to this one surface and don't belong in the shared palette.
const FLOATING_COLORS = {
  dark: {
    fill: 'rgba(22,27,33,0.82)',
    border: 'rgba(255,255,255,0.08)',
    activePill: 'rgba(242,193,78,0.16)',
    activeColor: '#F2C14E',
    inactiveColor: '#A3ADB8',
  },
  light: {
    fill: 'rgba(255,255,255,0.84)',
    border: 'rgba(15,23,42,0.1)',
    activePill: 'rgba(180,83,9,0.12)',
    activeColor: '#B45309',
    inactiveColor: '#5B6B7A',
  },
};

/**
 * Custom `tabBar` render prop for App.js's Tab.Navigator (boards 97/98/101,
 * owner-approved 2026-11-26) — replaces React Navigation's default bar so it
 * can render either docked (today's look, an ordinary full-width in-flow
 * bar) or floating (a rounded, translucent, `position: absolute` bar with
 * margin on every side, so content scrolls behind it rather than stopping
 * above it) off one setting, `useFloatingTabBar`. Re-implements the default
 * bar's own press/listener wiring (the `navigation.emit('tabPress')` dance)
 * since replacing the whole bar means React Navigation no longer does that
 * for us — `options.tabBarButton` (the onboarding tour's `TourTabButton`
 * wrapper on Community/Profile) is still honored, same as the default bar
 * does, so the tour's tab-bar spotlight steps keep working.
 */
export default function FloatingTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, effectiveMode } = useAppTheme();
  const { floatingTabBar: floatingSetting } = useFloatingTabBar();
  const floatingColors = FLOATING_COLORS[effectiveMode] || FLOATING_COLORS.dark;

  // Only the 4 tab roots (SkylineScreen, InsightsScreen, CommunityScreen/
  // CommunityComingSoonScreen, ProfileScreen) add the extra bottom padding
  // the floating bar needs (useTabBarOverlayInset) — a screen PUSHED on top
  // of one of those (Accessibility, Notifications, Privacy, Account, Sky
  // and weather, Skyline settings, and everything else reachable a level
  // deeper) never got that treatment, so the floating, no-layout-space bar
  // could sit directly over its content with no way to scroll clear. Rather
  // than hunting down and patching every such screen (and re-missing one
  // later), the bar falls back to normal docked behavior — reserving its
  // own space, like before this feature existed — the moment the focused
  // tab's own stack is anything but its root screen.
  const focusedRoute = state.routes[state.index];
  const isNestedScreen = focusedRoute.state ? focusedRoute.state.index > 0 : false;
  const floatingTabBar = floatingSetting && !isNestedScreen;

  const containerStyle = useMemo(
    () =>
      floatingTabBar
        ? [
            styles.floatingContainer,
            {
              left: FLOATING_BAR_SIDE_MARGIN,
              right: FLOATING_BAR_SIDE_MARGIN,
              bottom: FLOATING_BAR_BOTTOM_MARGIN + insets.bottom,
              height: FLOATING_BAR_HEIGHT,
              borderRadius: FLOATING_BAR_RADIUS,
              backgroundColor: floatingColors.fill,
              borderColor: floatingColors.border,
            },
          ]
        : [
            styles.dockedContainer,
            {
              height: DOCKED_HEIGHT + insets.bottom,
              paddingBottom: insets.bottom,
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ],
    [floatingTabBar, insets.bottom, floatingColors, colors],
  );

  return (
    <View style={containerStyle} testID="tab-bar" pointerEvents="box-none">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.tabBarLabel ?? options.title ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        const iconColor = floatingTabBar
          ? isFocused
            ? floatingColors.activeColor
            : floatingColors.inactiveColor
          : isFocused
            ? options.tabBarActiveTintColor || colors.accent
            : options.tabBarInactiveTintColor || colors.textMuted;
        const icon = options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: 24 });

        const content = floatingTabBar ? (
          <View style={[styles.floatingTabInner, isFocused && { backgroundColor: floatingColors.activePill }]}>
            {icon}
            <Text style={[styles.floatingLabel, { color: iconColor, fontFamily: isFocused ? fonts.extraBold : fonts.semiBold }]}>
              {label}
            </Text>
          </View>
        ) : (
          <View style={styles.dockedTabInner}>
            {icon}
            <Text style={[styles.dockedLabel, { color: iconColor }]}>{label}</Text>
          </View>
        );

        const buttonProps = {
          onPress,
          onLongPress,
          style: floatingTabBar ? styles.floatingTabButton : styles.dockedTabButton,
          accessibilityRole: 'button',
          accessibilityState: isFocused ? { selected: true } : {},
          accessibilityLabel: options.tabBarAccessibilityLabel ?? label,
          testID: options.tabBarTestID ?? `tab-${route.name}`,
          children: content,
        };

        // `key` is a reserved JSX attribute — React warns (and can misbehave)
        // if it rides along inside a spread object, so it's passed directly
        // here rather than living in `buttonProps` above.
        return (
          <React.Fragment key={route.key}>
            {options.tabBarButton ? options.tabBarButton(buttonProps) : <Pressable {...buttonProps} />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dockedContainer: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  dockedTabButton: { flex: 1, minHeight: 48 },
  dockedTabInner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dockedLabel: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
  floatingContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    // Buttons size to their own content (floatingTabButton/Inner below), not
    // flex:1 — space-evenly spreads the 4 of them across the bar instead,
    // leaving real gaps of just-the-translucent-background between them.
    // Those gaps are what let `pointerEvents="box-none"` on this container
    // actually pass taps through to scrolled content behind the bar; with
    // flex:1 buttons tiling edge to edge, there were no gaps at all, so
    // nothing behind the bar's full width was ever reachable.
    justifyContent: 'space-evenly',
    borderWidth: 1,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  // borderRadius + overflow:'hidden' here (not just on floatingTabInner
  // below) — Android's native press feedback draws against this outer
  // Pressable's own bounds, not its rounded child, so without clipping it
  // here too the persistent active pill looked rounded at rest but flashed
  // as a sharp rectangle the moment you actually tapped a tab.
  floatingTabButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    overflow: 'hidden',
  },
  floatingTabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 24,
  },
  floatingLabel: { fontSize: 12 },
});
