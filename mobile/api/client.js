import { Platform } from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';

// Placeholder until Firebase Auth lands in Phase 2 and the backend derives the
// user from a verified ID token instead of a query parameter.
export const DEMO_USER_ID = 'demo-user';

async function request(path, options = {}) {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${API_BASE_URL}${path}${separator}userId=${encodeURIComponent(DEMO_USER_ID)}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status})`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  health: () => request('/api/health'),

  listHabits: () => request('/api/habits'),

  createHabit: (habit) =>
    request('/api/habits', { method: 'POST', body: JSON.stringify(habit) }),

  updateHabit: (habitId, changes) =>
    request(`/api/habits/${habitId}`, { method: 'PUT', body: JSON.stringify(changes) }),

  archiveHabit: (habitId) => request(`/api/habits/${habitId}`, { method: 'DELETE' }),

  listCheckIns: (habitId) => request(`/api/habits/${habitId}/check-ins`),

  createCheckIn: (habitId, body = { value: 1, source: 'manual' }) =>
    request(`/api/habits/${habitId}/check-ins`, { method: 'POST', body: JSON.stringify(body) }),

  deleteCheckIn: (checkInId) => request(`/api/check-ins/${checkInId}`, { method: 'DELETE' }),
};

export default api;
