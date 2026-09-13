import React from 'react';
import PlaceholderScreen from './PlaceholderScreen';

export default function InsightsScreen() {
  return (
    <PlaceholderScreen
      title="Insights"
      phase="Phase 5"
      summary="Patterns need a few weeks of check-ins before they mean anything, so this page stays empty until the correlation job ships."
      items={[
        'Consistency ring with Daily / Weekly / Monthly / Yearly tabs',
        '“Pattern detected” cards built on the shared insight card',
        'Minimum sample size enforced before a match % is shown',
      ]}
    />
  );
}
