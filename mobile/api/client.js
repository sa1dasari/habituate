import Constants from 'expo-constants';
import { NativeModules, Platform } from 'react-native';
import { auth } from '../firebase';

const API_PORT = 8080;
const REQUEST_TIMEOUT_MS = 10000;

const LOOPBACK = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];

function cleanHost(value) {
  if (typeof value !== 'string' || value.length === 0) return null;

  // Accepts "192.168.1.5:8081", "http://192.168.1.5:8081/index.bundle", "exp://192.168.1.5:8081".
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const host = withoutScheme.split('/')[0].split('?')[0].split('#')[0].split(':')[0];

  if (!host || LOOPBACK.includes(host)) return null;
  return host;
}

/**
 * The dev machine's LAN address, discovered from whatever channel Expo exposes
 * it on. A physical device resolves `localhost` to itself, so without this every
 * request dies with a connection timeout. The sources are tried in order because
 * which ones are populated varies between Expo Go, dev builds, and emulators.
 */
function resolveDevHost() {
  const candidates = [
    Constants.expoConfig && Constants.expoConfig.hostUri,
    Constants.expoGoConfig && Constants.expoGoConfig.debuggerHost,
    Constants.manifest2 &&
      Constants.manifest2.extra &&
      Constants.manifest2.extra.expoGo &&
      Constants.manifest2.extra.expoGo.debuggerHost,
    Constants.experienceUrl,
    Constants.linkingUri,
    NativeModules && NativeModules.SourceCode && NativeModules.SourceCode.scriptURL,
  ];

  for (const candidate of candidates) {
    const host = cleanHost(candidate);
    if (host) return host;
  }

  return null;
}

function resolveBaseUrl() {
  // Set EXPO_PUBLIC_API_URL when the API is not on the Metro host (tunnels, staging).
  const override =
    process.env.EXPO_PUBLIC_API_URL ||
    (Constants.expoConfig && Constants.expoConfig.extra && Constants.expoConfig.extra.apiUrl);
  if (override) return String(override).replace(/\/+$/, '');

  if (Platform.OS === 'web') return `http://localhost:${API_PORT}`;

  const host = resolveDevHost();
  if (host) return `http://${host}:${API_PORT}`;

  // Emulators only: the Android emulator maps the host machine to 10.0.2.2.
  return Platform.OS === 'android'
    ? `http://10.0.2.2:${API_PORT}`
    : `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

if (__DEV__) {
  console.log(`[habituate] API base URL: ${API_BASE_URL}`);
}

/** Returns the current user's Firebase ID token, or null in demo mode. */
async function getIdToken() {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  const idToken = await getIdToken();
  const authHeader = idToken ? { Authorization: `Bearer ${idToken}` } : {};

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
        ...(options.headers || {}),
      },
    });
  } catch (err) {
    const timedOut = controller.signal.aborted || (err && err.name === 'AbortError');
    throw new Error(
      `Could not reach the API at ${API_BASE_URL}${timedOut ? ' (timed out)' : ''}. ` +
        'Check that the Spring Boot API is running, that this device is on the same network, ' +
        'and that the host firewall allows inbound TCP 8080. ' +
        'If the address above is wrong, set EXPO_PUBLIC_API_URL (or expo.extra.apiUrl in app.json).'
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `${options.method || 'GET'} ${path} failed (${response.status})${detail ? `: ${detail}` : ''}`
    );
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  health: () => request('/api/health'),

  listHabits: () => request('/api/habits'),

  listArchivedHabits: () => request('/api/habits?archived=true'),

  createHabit: (habit) =>
    request('/api/habits', { method: 'POST', body: JSON.stringify(habit) }),

  updateHabit: (habitId, changes) =>
    request(`/api/habits/${habitId}`, { method: 'PUT', body: JSON.stringify(changes) }),

  // Reversible: the habit leaves the active list but keeps its check-in history.
  archiveHabit: (habitId) =>
    request(`/api/habits/${habitId}`, { method: 'PUT', body: JSON.stringify({ archived: true }) }),

  restoreHabit: (habitId) =>
    request(`/api/habits/${habitId}`, { method: 'PUT', body: JSON.stringify({ archived: false }) }),

  // Permanent: removes the habit and every check-in logged against it.
  deleteHabit: (habitId) => request(`/api/habits/${habitId}`, { method: 'DELETE' }),

  listCheckIns: (habitId) => request(`/api/habits/${habitId}/check-ins`),

  createCheckIn: (habitId, body = { value: 1, source: 'manual' }) =>
    request(`/api/habits/${habitId}/check-ins`, { method: 'POST', body: JSON.stringify(body) }),

  deleteCheckIn: (checkInId) => request(`/api/check-ins/${checkInId}`, { method: 'DELETE' }),

  listGoals: () => request('/api/goals'),

  listArchivedGoals: () => request('/api/goals?archived=true'),

  createGoal: (goal) => request('/api/goals', { method: 'POST', body: JSON.stringify(goal) }),

  updateGoal: (goalId, changes) =>
    request(`/api/goals/${goalId}`, { method: 'PUT', body: JSON.stringify(changes) }),

  adjustGoalProgress: (goalId, delta) =>
    request(`/api/goals/${goalId}/progress`, { method: 'POST', body: JSON.stringify({ delta }) }),

  rolloverGoal: (goalId, periodStart) =>
    request(`/api/goals/${goalId}/rollover`, { method: 'POST', body: JSON.stringify({ periodStart }) }),

  archiveGoal: (goalId) =>
    request(`/api/goals/${goalId}`, { method: 'PUT', body: JSON.stringify({ archived: true }) }),

  deleteGoal: (goalId) => request(`/api/goals/${goalId}`, { method: 'DELETE' }),
};

export default api;
