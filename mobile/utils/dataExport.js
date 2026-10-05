import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Wraps a CSV field in quotes and escapes embedded quotes, per RFC 4180. */
function csvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(values) {
  return values.map(csvField).join(',') + '\r\n';
}

/**
 * Builds the export payload directly from what's already loaded client-side
 * (useHabits/useGoals) — no new backend endpoint, since every field here is
 * already fetched for the app's own screens. habits is the enriched array
 * from useHabits (each carries its own .checkIns).
 */
export function buildExportData(habits, goals) {
  return {
    exportedAt: new Date().toISOString(),
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      category: h.category,
      cadenceTarget: h.cadenceTarget,
      weeklyTarget: h.weeklyTarget,
      monthlyTarget: h.monthlyTarget,
      trackingMode: h.trackingMode,
      currentStreak: h.streak,
      longestStreak: h.longestStreak,
      checkIns: (h.checkIns || []).map((c) => ({
        occurredAt: c.occurredAt,
        value: c.value,
        source: c.source,
      })),
    })),
    goals: goals.map((g) => ({
      id: g.id,
      description: g.description,
      period: g.period,
      targetCount: g.targetCount,
      currentCount: g.currentCount,
      periodStart: g.periodStart,
    })),
  };
}

export function toJson(exportData) {
  return JSON.stringify(exportData, null, 2);
}

/** One row per check-in across every habit — the single most useful flat view of this data. */
export function toCsv(exportData) {
  let csv = toCsvRow(['habit_name', 'category', 'occurred_at', 'value', 'source']);
  for (const habit of exportData.habits) {
    for (const checkIn of habit.checkIns) {
      csv += toCsvRow([habit.name, habit.category, checkIn.occurredAt, checkIn.value, checkIn.source]);
    }
  }
  return csv;
}

/** Writes the content to a temp file and opens the native share sheet (save/email/AirDrop/etc). */
export async function shareExport(content, filename, mimeType) {
  const file = new File(Paths.cache, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(content);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: 'Export your Habituate data' });
}
