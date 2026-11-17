import { createContext, useContext } from 'react';

// True once the notification explainer is no longer pending (answered,
// skipped, or never needed). The location explainer waits on this so the two
// first-run cards never stack — notification first, then location (SKYLINE.md
// section 5). Defaults to true so a screen rendered without the host never
// blocks on it.
export const PushPromptContext = createContext(true);

export function usePushPromptDone() {
  return useContext(PushPromptContext);
}
