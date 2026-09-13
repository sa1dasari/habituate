import React from 'react';
import PlaceholderScreen from './PlaceholderScreen';

export default function CommunityScreen() {
  return (
    <PlaceholderScreen
      title="Community"
      phase="Phase 7"
      summary="Shared habits, group streaks and the friend feed arrive once the streak and group tables exist."
      items={[
        'Shared Habits built on the shared-habit card',
        'Challenges — time-boxed, no streak mechanics',
        'Friend activity feed',
      ]}
    />
  );
}
