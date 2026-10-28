/**
 * First-time-user onboarding tour (SKILLS.md — see Phase log). Each step
 * drives the TOUR to the real tab/screen/modal it describes — nothing here
 * is a static illustrated slide. `scope` says which mounted TourHighlight
 * (one per screen + one per spotlighted modal) is allowed to render this
 * step's spotlight+callout; `targetKey` (optional) is the TOUR_TARGETS key
 * the real element registered itself under via useTourTarget. A step with
 * no targetKey gets a centered callout over a full dim backdrop instead of
 * a cutout — used for the welcome/finish bookends and the two Protection
 * info screens, which are themselves the whole "target".
 */

export const TOUR_SCOPES = {
  TODAY: 'today',
  HABITS: 'habits',
  COMMUNITY: 'community',
  INSIGHTS: 'insights',
  CREATE_GROUP_MODAL: 'createGroupModal',
  CREATE_CHALLENGE_MODAL: 'createChallengeModal',
  ASK_HABITUATE_MODAL: 'askHabituateModal',
  PROTECTION_MODAL: 'protectionModal',
};

export const TOUR_TARGETS = {
  HABITS_ADD_BUTTON: 'habits-add-button',
  HABITS_FORM_CARD: 'habits-form-card',
  HABITS_SHIELD_ICON: 'habits-shield-icon',
  COMMUNITY_HEADER_ACTIONS: 'community-header-actions',
  COMMUNITY_CREATE_GROUP: 'community-create-group',
  COMMUNITY_CREATE_CHALLENGE: 'community-create-challenge',
  INSIGHTS_CONSISTENCY_CARD: 'insights-consistency-card',
  INSIGHTS_COACH_CARD: 'insights-coach-card',
  MODAL_CREATE_GROUP_HEADER: 'modal-create-group-header',
  MODAL_CREATE_CHALLENGE_HEADER: 'modal-create-challenge-header',
  MODAL_ASK_HABITUATE_HEADER: 'modal-ask-habituate-header',
};

export const TOUR_STEPS = [
  {
    id: 'welcome',
    scope: TOUR_SCOPES.TODAY,
    tab: 'Today',
    eyebrow: "LET'S GO",
    title: 'Welcome to Habituate',
    body: "60-second tour, real screens the whole way — not a slideshow. Bail anytime with Skip.",
  },
  {
    id: 'habits-intro',
    scope: TOUR_SCOPES.HABITS,
    tab: 'Habits',
    targetKey: TOUR_TARGETS.HABITS_ADD_BUTTON,
    eyebrow: 'BUILD YOUR ROUTINE',
    title: 'Habits start right here',
    body: '"+ New" builds one from scratch — name it, set a cadence (daily, weekly, monthly, or stack all three), pick how you log it.',
  },
  {
    id: 'habits-create-form',
    scope: TOUR_SCOPES.HABITS,
    tab: 'Habits',
    targetKey: TOUR_TARGETS.HABITS_FORM_CARD,
    eyebrow: 'MAKE IT YOURS',
    title: "You're looking at the real form",
    body: 'Name it, set a target, save. Editing works the exact same way later — tap any habit\'s pencil to reopen this, where Archive and Delete permanently also live.',
  },
  {
    id: 'habits-shield',
    scope: TOUR_SCOPES.HABITS,
    tab: 'Habits',
    targetKey: TOUR_TARGETS.HABITS_SHIELD_ICON,
    eyebrow: 'NO GUILT TRIPS HERE',
    title: 'Shield Days have your back',
    body: 'Long streaks bank a Shield automatically — up to 3. Miss a day with one banked and your streak survives overnight, no action needed.',
  },
  {
    id: 'shield-days-info',
    scope: TOUR_SCOPES.PROTECTION_MODAL,
    tab: 'Habits',
    eyebrow: 'THE ACTUAL RULES',
    title: "Here's exactly how it works",
    body: "Same screen you'll land on from the Habits tab any time you want the specifics again.",
  },
  {
    id: 'community-intro',
    scope: TOUR_SCOPES.COMMUNITY,
    tab: 'Community',
    targetKey: TOUR_TARGETS.COMMUNITY_HEADER_ACTIONS,
    eyebrow: 'BRING PEOPLE IN',
    title: 'Community is where it gets social',
    body: 'Add friends and catch notifications here. Shared Habits and Challenges live below — real setup screens coming up.',
  },
  {
    id: 'community-create-group',
    scope: TOUR_SCOPES.COMMUNITY,
    tab: 'Community',
    targetKey: TOUR_TARGETS.COMMUNITY_CREATE_GROUP,
    eyebrow: 'STREAK TOGETHER',
    title: 'Shared Habits = one streak, two people',
    body: 'Pick a habit, invite a friend, keep ONE streak alive between you. Tapping Create opens the real setup screen next.',
  },
  {
    id: 'shared-habit-form',
    scope: TOUR_SCOPES.CREATE_GROUP_MODAL,
    tab: 'Community',
    targetKey: TOUR_TARGETS.MODAL_CREATE_GROUP_HEADER,
    eyebrow: 'FOR REAL, THIS IS IT',
    title: 'The actual create screen',
    body: 'Choose your habit, set who has to check in for the streak to count, done. Friends you invite link their own matching habit.',
  },
  {
    id: 'community-create-challenge',
    scope: TOUR_SCOPES.COMMUNITY,
    tab: 'Community',
    targetKey: TOUR_TARGETS.COMMUNITY_CREATE_CHALLENGE,
    eyebrow: 'TIME-BOXED, ON PURPOSE',
    title: 'Challenges play by different rules',
    body: 'No running streak — just a target and a window, a week to a year. Solo, with friends, or thrown open to the public.',
  },
  {
    id: 'challenge-form',
    scope: TOUR_SCOPES.CREATE_CHALLENGE_MODAL,
    tab: 'Community',
    targetKey: TOUR_TARGETS.MODAL_CREATE_CHALLENGE_HEADER,
    eyebrow: 'THE REAL SCREEN',
    title: 'Build your own Challenge',
    body: 'Name, target, cadence, duration, public or private — all your call. "Create & join" is one tap away whenever you mean it.',
  },
  {
    id: 'streak-freeze-info',
    scope: TOUR_SCOPES.PROTECTION_MODAL,
    tab: 'Community',
    eyebrow: 'GROUP STREAKS, COVERED',
    title: 'Streak Freezes protect the group',
    body: "If a Shared Habit's streak would break, a freeze auto-applies overnight if one's available — that day shows as frozen, never broken, never red.",
  },
  {
    id: 'insights-consistency',
    scope: TOUR_SCOPES.INSIGHTS,
    tab: 'Insights',
    targetKey: TOUR_TARGETS.INSIGHTS_CONSISTENCY_CARD,
    eyebrow: 'SEE THE PATTERN',
    title: 'Your consistency, at a glance',
    body: 'Daily through yearly. Tap the ring for a real per-habit breakdown — history, bar graph, plain-language takeaway.',
  },
  {
    id: 'insights-coach',
    scope: TOUR_SCOPES.INSIGHTS,
    tab: 'Insights',
    targetKey: TOUR_TARGETS.INSIGHTS_COACH_CARD,
    eyebrow: 'YOUR AI COACH',
    title: 'Meet Ask Habituate',
    body: "Grounded in YOUR real check-ins, not generic advice. It can even suggest a tweak — nothing changes until you confirm.",
  },
  {
    id: 'ask-habituate-chat',
    scope: TOUR_SCOPES.ASK_HABITUATE_MODAL,
    tab: 'Insights',
    targetKey: TOUR_TARGETS.MODAL_ASK_HABITUATE_HEADER,
    eyebrow: 'THE ACTUAL CHAT',
    title: "You're in the real coach right now",
    body: 'Starter questions are right there any time. It can propose creating or adjusting a habit — you always get the final say.',
  },
  {
    id: 'finish',
    scope: TOUR_SCOPES.TODAY,
    tab: 'Today',
    eyebrow: "THAT'S THE WHOLE TOUR",
    title: "You're set. Go build something.",
    body: 'Replay this anytime from Profile → Account Settings → Replay tour.',
  },
];
