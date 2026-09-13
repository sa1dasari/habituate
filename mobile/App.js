import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080';
const DEMO_USER_ID = 'demo-user';

function computeStreak(checkIns) {
  if (!checkIns || checkIns.length === 0) return 0;

  const dates = new Set(
    checkIns.map((checkIn) => new Date(checkIn.occurredAt).toISOString().slice(0, 10))
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (dates.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  return streak;
}

function formatDate(epochString) {
  if (!epochString) return 'no date';
  return new Date(epochString).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const emptyForm = {
  name: '',
  category: 'Health',
  cadenceType: 'DAILY',
  cadenceTarget: '1',
};

export default function App() {
  const [habits, setHabits] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadHabits = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/habits?userId=${DEMO_USER_ID}`);
      if (!response.ok) {
        throw new Error('Unable to load habits');
      }

      const data = await response.json();
      const hydrated = await Promise.all(
        data.map(async (habit) => {
          const checkInResponse = await fetch(
            `${API_BASE_URL}/api/habits/${habit.id}/check-ins?userId=${DEMO_USER_ID}`
          );
          const checkIns = checkInResponse.ok ? await checkInResponse.json() : [];
          return {
            ...habit,
            checkIns,
            streak: computeStreak(checkIns),
            lastCheckIn: checkIns[0] ? checkIns[0].occurredAt : null,
          };
        })
      );

      setHabits(hydrated);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load habits');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHabits();
  }, []);

  const createHabit = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      Alert.alert('Missing habit name', 'Please add a habit name first.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/habits?userId=${DEMO_USER_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          category: form.category,
          cadenceType: form.cadenceType,
          cadenceTarget: Number(form.cadenceTarget || 1),
        }),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      setForm(emptyForm);
      await loadHabits();
    } catch (err) {
      Alert.alert('Could not create habit', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const logCheckIn = async (habitId) => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/habits/${habitId}/check-ins?userId=${DEMO_USER_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: 1, source: 'manual' }),
      });

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      await loadHabits();
    } catch (err) {
      Alert.alert('Check-in failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const undoCheckIn = async (habitId) => {
    const habit = habits.find((item) => item.id === habitId);
    if (!habit || !habit.checkIns.length) {
      return;
    }

    try {
      setSaving(true);
      const latest = habit.checkIns[0];
      const response = await fetch(`${API_BASE_URL}/api/check-ins/${latest.id}?userId=${DEMO_USER_ID}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Undo failed');
      }

      await loadHabits();
    } catch (err) {
      Alert.alert('Undo failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Habituate</Text>
        <Text style={styles.subtitle}>Phase 1 habit tracker</Text>

        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Add a habit</Text>

          <TextInput
            style={styles.input}
            placeholder="Habit name"
            value={form.name}
            onChangeText={(value) => setForm({ ...form, name: value })}
          />

          <TextInput
            style={styles.input}
            placeholder="Category"
            value={form.category}
            onChangeText={(value) => setForm({ ...form, category: value })}
          />

          <View style={styles.row}>
            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Cadence</Text>
              <TextInput
                style={styles.input}
                value={form.cadenceType}
                onChangeText={(value) => setForm({ ...form, cadenceType: value.toUpperCase() })}
              />
            </View>

            <View style={styles.fieldHalf}>
              <Text style={styles.label}>Target</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={form.cadenceTarget}
                onChangeText={(value) => setForm({ ...form, cadenceTarget: value })}
              />
            </View>
          </View>

          <Pressable style={styles.primaryButton} onPress={createHabit} disabled={saving}>
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving...' : 'Add habit'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loaderText}>Loading habits…</Text>
          </View>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <View style={styles.listSection}>
            {habits.length === 0 ? (
              <Text style={styles.emptyState}>No habits yet. Add your first habit above.</Text>
            ) : (
              habits.map((habit) => (
                <View key={habit.id} style={styles.habitCard}>
                  <View style={styles.habitTopRow}>
                    <View>
                      <Text style={styles.habitName}>{habit.name}</Text>
                      <Text style={styles.habitMeta}>
                        {habit.category} · {habit.cadenceType}
                      </Text>
                    </View>
                    <Text style={styles.streakBadge}>{habit.streak} day streak</Text>
                  </View>

                  <Text style={styles.dateText}>
                    Last check-in: {habit.lastCheckIn ? formatDate(habit.lastCheckIn) : 'never'}
                  </Text>

                  <View style={styles.buttonRow}>
                    <Pressable style={styles.secondaryButton} onPress={() => logCheckIn(habit.id)}>
                      <Text style={styles.secondaryButtonText}>Check in</Text>
                    </Pressable>

                    {habit.checkIns.length > 0 ? (
                      <Pressable style={styles.ghostButton} onPress={() => undoCheckIn(habit.id)}>
                        <Text style={styles.ghostButtonText}>Undo</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 18,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldHalf: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginBottom: 6,
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  loaderText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#374151',
  },
  error: {
    color: '#b91c1c',
    fontSize: 15,
    marginTop: 10,
  },
  listSection: {
    marginTop: 10,
  },
  emptyState: {
    color: '#6b7280',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
  habitCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  habitTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  habitName: {
    fontSize: 20,
    fontWeight: '700',
  },
  habitMeta: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: '700',
    fontSize: 12,
  },
  dateText: {
    color: '#374151',
    fontSize: 13,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  ghostButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ghostButtonText: {
    color: '#374151',
    fontWeight: '700',
  },
});
