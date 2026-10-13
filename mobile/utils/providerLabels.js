/** Firebase providerId -> human-readable label, shared by useAuth's collision
 * messages and LoginSecurityScreen's "linked accounts" list. */
export const PROVIDER_LABELS = {
  password: 'email and password',
  'google.com': 'Google',
  'facebook.com': 'Facebook',
  'apple.com': 'Apple',
};

export function labelForProviderId(providerId) {
  return PROVIDER_LABELS[providerId] || providerId;
}
