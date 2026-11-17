import React from 'react';
import FirstRunExplainer from './FirstRunExplainer';

/**
 * One-time, in-app explainer shown before the OS push-permission dialog —
 * see usePushPermissionPrompt (hooks/usePushToken.js) for why: framing the
 * value first measurably improves opt-in versus letting the bare system
 * prompt be a user's first signal. Look is the shared first-run card
 * (design-review board 37); the copy is unchanged.
 */
export default function PushPermissionModal({ visible, onAllow, onDismiss }) {
  return (
    <FirstRunExplainer
      visible={visible}
      onAllow={onAllow}
      onDismiss={onDismiss}
      icon="bell-outline"
      iconColor="#F2C14E"
      iconBg="rgba(242,193,78,0.16)"
      title="Stay on track"
      message="Get a gentle reminder right when it's time for a habit — no spam, just the nudges you set up yourself. You can turn any of this off later in Notification Settings."
      dismissLabel="Not now"
      allowLabel="Allow notifications"
      testID="push-explainer"
    />
  );
}
