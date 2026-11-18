import React from 'react';
import FirstRunExplainer from './FirstRunExplainer';

/**
 * One-time, plain-language explainer shown before the OS location-permission
 * dialog — SKYLINE.md section 5: "asked once, after the user's first floor,
 * with a plain-language explainer first." Fired by SkylineScreen after a
 * successful hold (and after the notification explainer has been answered),
 * not on mount. Look is the shared first-run card (design-review board 38);
 * the copy is unchanged.
 */
export default function LocationPermissionModal({ visible, onAllow, onDismiss }) {
  return (
    <FirstRunExplainer
      visible={visible}
      onAllow={onAllow}
      onDismiss={onDismiss}
      icon="weather-partly-cloudy"
      iconColor="#7CC4F5"
      iconBg="rgba(124,196,245,0.18)"
      title="Match your sky to your weather"
      message="With your approximate location, your skyline's sky can show real clouds, rain or snow — not just the clock. It's never shown precisely, never shared, and stays on this device. Skip and the sky still follows the time of day."
      dismissLabel="Skip"
      allowLabel="Allow location"
      testID="location-explainer"
    />
  );
}
