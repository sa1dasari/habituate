import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg from 'react-native-svg';
import ScrubberInput from './ScrubberInput';
import TimePicker from './TimePicker';
import SkylineTower from './SkylineTower';
import Toast from './Toast';
import ConfirmModal from './ConfirmModal';
import PaywallSheet from './PaywallSheet';
import { useToast } from '../hooks/useToast';
import { useConfirm } from '../hooks/useConfirm';
import { useHabits } from '../hooks/useHabits';
import { useEntitlement } from '../hooks/useEntitlement';
import { HABIT_CATEGORIES, HABIT_CATEGORY_OPTIONS, DEFAULT_HABIT_CATEGORY, categoryColor } from '../constants/habitCategories';
import { effectiveWeeklyTarget, effectiveMonthlyTarget } from '../utils/cadence';
import { countByCap, isAtCap } from '../utils/entitlements';
import { buildScene, X0, TOWER_W, DX, CRANE_HEIGHT, FLOOR_H, BASE_Y } from '../utils/skylineScene';
import TowerColorPicker from './TowerColorPicker';
import { useAppTheme } from '../hooks/useAppTheme';
import { useShowFinishedTowers } from '../hooks/useShowFinishedTowers';
import { resolveHabitColor } from '../constants/towerColors';
import { fonts } from '../theme';

const DEFAULT_TOP_OUT_THRESHOLD_DAYS = 30;

const CADENCE_OPTIONS = [
  { value: 'DAILY', label: 'Daily', targetField: 'dailyTarget', noun: 'Daily view' },
  { value: 'WEEKLY', label: 'Weekly', targetField: 'weeklyTarget', noun: 'Weekly & Monthly view' },
  { value: 'MONTHLY', label: 'Monthly', targetField: 'monthlyTarget', noun: 'Weekly & Monthly view' },
];

function emptyForm() {
  return {
    id: null,
    name: '',
    category: DEFAULT_HABIT_CATEGORY,
    cadence: 'DAILY',
    dailyTarget: '',
    weeklyTarget: '',
    monthlyTarget: '',
    trackingMode: 'BOOLEAN',
    featuredGoal: false,
    scheduledTime: '',
    reminderEnabled: false,
    motivation: '',
    topOutThresholdDays: null,
    color: null,
    unit: '',
  };
}

/** Mirrors HabitsScreen.js's formFromHabit exactly, including its fallback
 * to effectiveWeeklyTarget/effectiveMonthlyTarget — a legacy habit whose
 * cadenceType is still the old WEEKLY/MONTHLY enum keeps its target in
 * cadenceTarget, not weeklyTarget/monthlyTarget (utils/cadence.js), so a
 * plain `habit.weeklyTarget > 0` check alone would load this form with an
 * empty target field for that habit and then wipe it on save — the same
 * silent-clear shape as the topOutThresholdDays bug fixed earlier today. */
function formFromHabit(habit) {
  const wt = (habit.weeklyTarget > 0 ? habit.weeklyTarget : null) || effectiveWeeklyTarget(habit) || 0;
  const mt = (habit.monthlyTarget > 0 ? habit.monthlyTarget : null) || effectiveMonthlyTarget(habit) || 0;
  // Best-guess cadence for an existing habit, purely to decide which target
  // field this form highlights first — doesn't change what's persisted.
  const cadence = !habit.cadenceType || String(habit.cadenceType).toUpperCase() === 'DAILY'
    ? (wt > 0 && !(habit.cadenceTarget > 1) ? 'WEEKLY' : mt > 0 && !(habit.cadenceTarget > 1) ? 'MONTHLY' : 'DAILY')
    : String(habit.cadenceType).toUpperCase();

  return {
    id: habit.id,
    name: habit.name || '',
    category: HABIT_CATEGORY_OPTIONS.some((o) => o.value === habit.category) ? habit.category : DEFAULT_HABIT_CATEGORY,
    cadence,
    dailyTarget: habit.cadenceTarget && habit.cadenceTarget > 1 ? String(habit.cadenceTarget) : '',
    weeklyTarget: wt > 0 ? String(wt) : '',
    monthlyTarget: mt > 0 ? String(mt) : '',
    trackingMode: String(habit.trackingMode || 'BOOLEAN').toUpperCase() === 'COUNT' ? 'COUNT' : 'BOOLEAN',
    featuredGoal: Boolean(habit.featuredGoal),
    scheduledTime: habit.scheduledTime || '',
    reminderEnabled: Boolean(habit.reminderEnabled),
    motivation: habit.motivation || '',
    topOutThresholdDays: habit.topOutThresholdDays != null ? Math.min(35, habit.topOutThresholdDays) : null,
    color: habit.color || null,
    unit: habit.unit || '',
  };
}

/**
 * Phase 4's "Lay a foundation" form (SKYLINE.md section 10/11), replacing
 * HabitsScreen.js's inline create/edit form for daily towers. Kept as a new
 * file per the working agreement — HabitsScreen.js stays untouched and
 * working until every screen that deep-links to it (TowerSheet.js's Edit)
 * is repointed and the whole old screen can go in one cleanup commit.
 *
 * Cadence model (owner decision, 2026-11-12): kept the existing multi-target
 * data model — a habit can still carry a daily, weekly AND monthly target at
 * once, same as HabitsScreen.js always allowed. The new cadence picker above
 * the target fields doesn't gate which fields exist (hiding a field that
 * already has a value is exactly the silent-data-loss shape this session
 * already found and fixed once for topOutThresholdDays) — it only decides
 * which target field renders first/highlighted, and seeds a default of '1'
 * for that one field at submit time if the user picked a cadence but left
 * its number blank, so the habit actually lands in the view they chose.
 * `cadenceType` sent to the API is unchanged (always 'DAILY') — classification
 * is still the existing target-presence inference in utils/cadence.js /
 * HabitService.hasDailyTarget, which this form doesn't change.
 *
 * Live preview: a real `buildScene` render of a single synthetic
 * 'Foundation' tower (startDate = today, no check-ins yet), not a
 * hand-drawn approximation — classifyDays naturally produces exactly one
 * 'open' floor for a habit whose startDate is today, which is the
 * "foundation, not yet built" state the mockup shows, using the real
 * engine so this can never visually drift from the actual tower.
 *
 * "Feature on Goals": visible only when a period (weekly/monthly) target is
 * set, same as the old form — but unlike the old form, this one clears the
 * flag in local state the moment the last period target is removed, instead
 * of leaving a stale `true` in state that only gets silently dropped at
 * submit time. The visible toggle and the persisted value never disagree.
 */
export default function TowerForm({ visible, onClose, habit, theme, towerTheme, categoryColors }) {
  const { habits, createHabit, updateHabit, deleteHabit } = useHabits();
  const { effectiveMode } = useAppTheme();
  const { showFinishedTowers: globalShowFinishedTowers, habitOverrides, setHabitOverride } = useShowFinishedTowers();
  const { toast, showToast, hideToast } = useToast();
  const { request, confirm, respond } = useConfirm();
  const { isPro } = useEntitlement();
  const [form, setForm] = useState(() => (habit ? formFromHabit(habit) : emptyForm()));
  const [busy, setBusy] = useState(false);
  const [paywallCap, setPaywallCap] = useState(null);
  const isEditing = form.id != null;

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const hasPeriodTarget = Number(form.weeklyTarget) > 0 || Number(form.monthlyTarget) > 0;

  const setTarget = (key, value) => {
    setForm((f) => {
      const next = { ...f, [key]: value };
      const nextHasPeriodTarget = Number(next.weeklyTarget) > 0 || Number(next.monthlyTarget) > 0;
      // See the doc comment above — clear a now-meaningless pin immediately,
      // don't leave it stranded in state for formToPayload to clamp silently.
      if (!nextHasPeriodTarget) next.featuredGoal = false;
      return next;
    });
  };

  const previewHabit = useMemo(() => {
    const todayKey = toTodayKey();
    return {
      id: 'preview',
      name: form.name.trim() || 'New tower',
      color: resolveHabitColor({ color: form.color, category: form.category }, effectiveMode, categoryColors) || categoryColor(form.category),
      cadenceType: 'DAILY',
      cadenceTarget: 1,
      startDate: todayKey,
      checkInDays: [],
      shieldDays: [],
      currentRun: 0,
      bestRun: null,
      state: 'active',
    };
  }, [form.name, form.category, form.color, effectiveMode, categoryColors]);

  const previewScene = useMemo(
    () => buildScene([previewHabit], { today: new Date(), theme: towerTheme }),
    [previewHabit, towerTheme],
  );
  const previewShapes = previewScene.shapes.filter((s) => s.towerId === 'preview');
  // Tight crop around a one-floor-plus-crane tower at index 0 (x = X0).
  const previewBox = {
    x: X0 - 8,
    y: BASE_Y - FLOOR_H - CRANE_HEIGHT - 12,
    width: TOWER_W + DX + 16,
    height: FLOOR_H + CRANE_HEIGHT + 20,
  };

  const submit = async () => {
    if (!form.name.trim()) {
      showToast('Give the tower a name first.', 'error');
      return;
    }

    // Free-tier cap (SKYLINE.md section 14 #21, boards 87/88/90) — create
    // mode only, keyed off the cadence tab the user actually picked (the
    // clearest signal of intent for a draft that isn't saved yet; an
    // already-saved habit's classification — see utils/entitlements.js —
    // handles the ambiguous legacy cases this doesn't need to). The server
    // enforces this too (HabitService.requireUnderFreeTierCap) as a
    // backstop; this check is purely so the paywall shows immediately
    // instead of after a round trip.
    //
    // performSubmit (below) is the part that actually saves — PaywallSheet's
    // onUnlocked calls that directly, not this gate. Right after a purchase
    // succeeds, useEntitlement's isPro hasn't necessarily updated yet (it
    // depends on a RevenueCat listener firing), and this closure's own
    // `isPro` is whatever it was when submit() was created — re-running the
    // gate here could re-open the paywall immediately after a successful
    // unlock. The purchase success itself is the proof; no need to re-check.
    if (!isEditing) {
      const cap = form.cadence === 'MONTHLY' ? 'monthly' : form.cadence === 'WEEKLY' ? 'weekly' : 'daily';
      if (isAtCap(cap, countByCap(habits), isPro)) {
        setPaywallCap(cap);
        return;
      }
    }
    await performSubmit();
  };

  const performSubmit = async () => {
    const cadenceMeta = CADENCE_OPTIONS.find((c) => c.value === form.cadence);
    const filled = { ...form };
    // Seed a default of 1 for the chosen cadence's own target field only if
    // the user picked a cadence but left its number blank — same "blank
    // daily target defaults to 1" convention the old form already used.
    if (cadenceMeta && !filled[cadenceMeta.targetField]) {
      filled[cadenceMeta.targetField] = '1';
    }

    const weeklyTarget = Number(filled.weeklyTarget) || null;
    const monthlyTarget = Number(filled.monthlyTarget) || null;
    const payload = {
      name: filled.name.trim(),
      category: filled.category || DEFAULT_HABIT_CATEGORY,
      cadenceType: 'DAILY',
      cadenceTarget: Number(filled.dailyTarget) || 1,
      weeklyTarget,
      monthlyTarget,
      trackingMode: filled.trackingMode,
      featuredGoal: filled.featuredGoal,
      scheduledTime: filled.scheduledTime || '',
      reminderEnabled: Boolean(filled.scheduledTime) && filled.reminderEnabled,
      motivation: filled.motivation.trim(),
      topOutThresholdDays: filled.topOutThresholdDays ?? null,
      // A palette key, or null (create: no pick; update: leave as is).
      color: filled.color ?? null,
      // A stale unit from a prior COUNT selection shouldn't survive a
      // switch back to Check-off — same reasoning already applied to
      // featuredGoal when the last period target is removed.
      unit: filled.trackingMode === 'COUNT' ? filled.unit.trim() : '',
    };

    setBusy(true);
    try {
      if (isEditing) {
        await updateHabit(form.id, payload);
      } else {
        await createHabit(payload);
        // Create mode is always remounted under the same key ('new'), so
        // unlike edit mode (keyed per habit id, which naturally resets on
        // reopen) a just-submitted draft would otherwise still be sitting
        // in state the next time "Create your own tower" is tapped.
        setForm(emptyForm());
      }
      onClose();
    } catch (err) {
      showToast(
        `${isEditing ? 'Could not save changes' : 'Could not lay the foundation'} — ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this tower?',
      message: 'This permanently removes it and every check-in on it. This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteHabit(form.id);
      onClose();
    } catch (err) {
      showToast(`Could not delete tower — ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              // Same reasoning as the post-submit reset — create mode is
              // always remounted under the same 'new' key, so a cancelled
              // draft has to be cleared explicitly or it reappears next open.
              if (!isEditing) setForm(emptyForm());
              onClose();
            }}
            hitSlop={12}
            testID="tower-form-cancel"
          >
            <Text style={[styles.cancel, { color: theme.muted }]}>Cancel</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: theme.text }]}>{isEditing ? 'Edit tower' : 'Lay a foundation'}</Text>
          <Text style={[styles.subtitle, { color: theme.muted }]}>
            {isEditing
              ? 'Changes apply from today. Your floors and run stay as they are.'
              : 'Your new tower grows one floor each time you build.'}
          </Text>

          {!isEditing && (
          <View style={[styles.previewCard, { backgroundColor: theme.surfaceHigh }]}>
            <Svg
              width={140}
              height={140 * (previewBox.height / previewBox.width)}
              viewBox={`${previewBox.x} ${previewBox.y} ${previewBox.width} ${previewBox.height}`}
            >
              <SkylineTower shapes={previewShapes} />
            </Svg>
            <Text style={[styles.previewLabel, { color: theme.muted }]}>Foundation</Text>
            <Text style={[styles.previewNoun, { color: theme.muted }]}>
              Lives in your {CADENCE_OPTIONS.find((c) => c.value === form.cadence)?.noun}
            </Text>
          </View>
          )}

          <Field label="Name your tower" theme={theme}>
            <TextInput
              value={form.name}
              onChangeText={(v) => setField('name', v)}
              placeholder="e.g. Read, Write, Run"
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border || 'rgba(128,128,128,0.3)' }]}
              testID="tower-form-name"
            />
          </Field>

          <Field label="Category" theme={theme}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {HABIT_CATEGORIES.map((cat) => {
                const selected = form.category === cat;
                const color = categoryColors[cat] || categoryColor(cat);
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setField('category', cat)}
                    style={[
                      styles.chip,
                      { borderColor: selected ? color : theme.border || 'rgba(128,128,128,0.3)' },
                      selected && { backgroundColor: `${color}22` },
                    ]}
                    testID={`tower-form-category-${cat}`}
                  >
                    <View style={[styles.chipDot, { backgroundColor: color }]} />
                    <Text style={[styles.chipText, { color: theme.text }]}>{cat}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>

          <TowerColorPicker
            value={form.color}
            onChange={(key) => setField('color', key)}
            theme={theme}
            mode={effectiveMode}
          />

          <Field label="How often do you build a floor?" theme={theme}>
            <View style={styles.pillRow}>
              {CADENCE_OPTIONS.map((opt) => {
                const selected = form.cadence === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setField('cadence', opt.value)}
                    style={[
                      styles.pill,
                      { borderColor: selected ? theme.amber : theme.border || 'rgba(128,128,128,0.3)' },
                      selected && { backgroundColor: `${theme.amber}22` },
                    ]}
                    testID={`tower-form-cadence-${opt.value}`}
                  >
                    <Text style={[styles.pillText, { color: theme.text }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          <Field label="What counts as a floor?" theme={theme}>
            <View style={styles.pillRow}>
              {[
                { value: 'BOOLEAN', label: 'Check-off' },
                { value: 'COUNT', label: 'An amount' },
              ].map((opt) => {
                const selected = form.trackingMode === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() =>
                      setForm((f) => ({
                        ...f,
                        trackingMode: opt.value,
                        // A Check-off habit is always exactly 1/day server-side
                        // (see the "Times per day" field below) — clear a
                        // stale >1 value from a prior COUNT selection instead
                        // of hiding the field while still submitting it.
                        dailyTarget: opt.value === 'BOOLEAN' ? '' : f.dailyTarget,
                      }))
                    }
                    style={[
                      styles.pill,
                      { borderColor: selected ? theme.amber : theme.border || 'rgba(128,128,128,0.3)' },
                      selected && { backgroundColor: `${theme.amber}22` },
                    ]}
                    testID={`tower-form-mode-${opt.value}`}
                  >
                    <Text style={[styles.pillText, { color: theme.text }]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Field>

          {form.trackingMode === 'COUNT' && (
            <Field label="Times per day" theme={theme} sublabel="Leave at 1 for a simple check-off">
              {/* Check-off (BOOLEAN) habits are always exactly one check-in
                  per day, enforced server-side (HabitService.java) no matter
                  what cadenceTarget says — showing this scrubber for a
                  Check-off habit let the user set a target the backend would
                  never actually honor. Only an "amount" (COUNT) habit can
                  mean more than one. min is always 1, never 0 — a habit
                  always has to land in some cadence (section 4a), so "no
                  daily target" is expressed by leaving this at the 1 floor
                  and setting a period target below instead. */}
              <ScrubberInput
                value={Number(form.dailyTarget) || 1}
                onChange={(v) => setTarget('dailyTarget', v > 1 ? String(v) : '')}
                min={1}
                max={200}
                label="times/day"
              />
            </Field>
          )}

          {form.trackingMode === 'COUNT' && (
            <Field
              label="Unit (optional)"
              theme={theme}
              sublabel={'Shown next to amounts, like "300 words". Leave it empty for a plain number.'}
            >
              <TextInput
                value={form.unit}
                onChangeText={(v) => setField('unit', v)}
                placeholder="words"
                placeholderTextColor={theme.muted}
                maxLength={30}
                style={[styles.input, { color: theme.text, borderColor: theme.border || 'rgba(128,128,128,0.3)' }]}
                testID="tower-form-unit"
              />
            </Field>
          )}

          <Field label="Also track a weekly target (optional)" theme={theme}>
            <TextInput
              value={form.weeklyTarget}
              onChangeText={(v) => setTarget('weeklyTarget', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="e.g. 3"
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border || 'rgba(128,128,128,0.3)' }]}
              testID="tower-form-weekly-target"
            />
          </Field>

          <Field label="Also track a monthly target (optional)" theme={theme}>
            <TextInput
              value={form.monthlyTarget}
              onChangeText={(v) => setTarget('monthlyTarget', v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="e.g. 10"
              placeholderTextColor={theme.muted}
              style={[styles.input, { color: theme.text, borderColor: theme.border || 'rgba(128,128,128,0.3)' }]}
              testID="tower-form-monthly-target"
            />
          </Field>

          {hasPeriodTarget && (
            <Field label="Feature on Goals" theme={theme} row>
              <Switch
                value={form.featuredGoal}
                onValueChange={(v) => setField('featuredGoal', v)}
                testID="tower-form-featured-goal"
              />
            </Field>
          )}

          <Field label="Best time (optional)" theme={theme}>
            <TimePicker value={form.scheduledTime} onChange={(v) => setField('scheduledTime', v)} />
          </Field>

          {!!form.scheduledTime && (
            <Field label="Remind me" theme={theme} row>
              <Switch
                value={form.reminderEnabled}
                onValueChange={(v) => setField('reminderEnabled', v)}
                testID="tower-form-reminder"
              />
            </Field>
          )}

          <Field label="Why does this matter? (optional)" theme={theme}>
            <TextInput
              value={form.motivation}
              onChangeText={(v) => setField('motivation', v)}
              placeholder="So the book gets finished"
              placeholderTextColor={theme.muted}
              multiline
              maxLength={500}
              style={[styles.input, styles.multiline, { color: theme.text, borderColor: theme.border || 'rgba(128,128,128,0.3)' }]}
              testID="tower-form-motivation"
            />
          </Field>

          {/* The tower's cap (SKYLINE.md section 6, revised 2026-11-17): it
              tops out on its own after this many days, and you can top it
              out any day before. 1-35, default 30; set at creation or edit. */}
          <Field
            label="Top out after (days)"
            theme={theme}
            sublabel="Your tower tops out on its own after this many days, 35 at most. You can also top it out any time from the tower sheet."
          >
            <ScrubberInput
              value={form.topOutThresholdDays ?? DEFAULT_TOP_OUT_THRESHOLD_DAYS}
              onChange={(v) => setField('topOutThresholdDays', v)}
              min={1}
              max={35}
              label="days"
            />
          </Field>

          {/* Board 45: overrides the Accessibility "Show finished towers"
              default for just this tower. Only meaningful once the tower
              exists (a brand-new one has no finished segments yet). */}
          {isEditing && (
            <Field
              label="Show this tower when finished"
              theme={theme}
              sublabel={
                habitOverrides[String(form.id)] === undefined
                  ? `Following your Accessibility setting (currently ${globalShowFinishedTowers ? 'on' : 'off'}).`
                  : 'Overriding your Accessibility setting for this tower only.'
              }
            >
              <View style={styles.finishedTowerRow}>
                <Switch
                  value={
                    habitOverrides[String(form.id)] === undefined
                      ? globalShowFinishedTowers
                      : habitOverrides[String(form.id)]
                  }
                  onValueChange={(v) => setHabitOverride(form.id, v)}
                  accessibilityLabel="Show this tower when finished"
                  accessibilityRole="switch"
                  testID="tower-form-show-finished"
                />
                {habitOverrides[String(form.id)] !== undefined && (
                  <Pressable
                    onPress={() => setHabitOverride(form.id, null)}
                    testID="tower-form-show-finished-reset"
                    accessibilityRole="button"
                    accessibilityLabel="Use the default setting"
                  >
                    <Text style={[styles.resetLink, { color: theme.amber }]}>Use default</Text>
                  </Pressable>
                )}
              </View>
            </Field>
          )}

        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.border || 'rgba(128,128,128,0.3)' }]}>
          <Pressable
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Save changes' : 'Lay foundation'}
            style={[styles.submitBtn, { backgroundColor: theme.amber, opacity: busy ? 0.6 : 1 }]}
            testID="tower-form-submit"
          >
            <Text style={styles.submitLabel}>{busy ? 'Saving…' : isEditing ? 'Save changes' : 'Lay foundation'}</Text>
          </Pressable>

          {isEditing && (
            <Pressable
              onPress={handleDelete}
              style={styles.deleteBtn}
              accessibilityRole="button"
              accessibilityLabel="Delete tower"
              testID="tower-form-delete"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.muted} />
              <Text style={[styles.deleteLabel, { color: theme.muted }]}>Delete tower</Text>
            </Pressable>
          )}
        </View>
        </KeyboardAvoidingView>

        <Toast toast={toast} onHide={hideToast} />
        <ConfirmModal request={request} onRespond={respond} />
      </SafeAreaView>
    </Modal>
    <PaywallSheet
      visible={!!paywallCap}
      cap={paywallCap}
      counts={countByCap(habits)}
      onClose={() => setPaywallCap(null)}
      onUnlocked={() => {
        setPaywallCap(null);
        performSubmit();
      }}
    />
    </>
  );
}

function toTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function Field({ label, sublabel, theme, row, children }) {
  return (
    <View style={[styles.field, row && styles.fieldRow]}>
      <View style={row ? styles.fieldRowLabelWrap : undefined}>
        <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
        {sublabel && <Text style={[styles.fieldSublabel, { color: theme.muted }]}>{sublabel}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth },
  header: { paddingHorizontal: 20, paddingTop: 12 },
  cancel: { fontFamily: fonts.semiBold, fontSize: 15 },
  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  title: { fontFamily: fonts.extraBold, fontSize: 26, marginTop: 8 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 4, marginBottom: 16 },
  previewCard: { borderRadius: 20, alignItems: 'center', paddingVertical: 16, marginBottom: 20 },
  previewLabel: { fontFamily: fonts.semiBold, fontSize: 12, marginTop: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  previewNoun: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  field: { marginBottom: 18 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldRowLabelWrap: { flex: 1, paddingRight: 12 },
  fieldLabel: { fontFamily: fonts.semiBold, fontSize: 14, marginBottom: 8 },
  fieldSublabel: { fontFamily: fonts.regular, fontSize: 12, marginTop: -4, marginBottom: 8 },
  input: { fontFamily: fonts.regular, fontSize: 15, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  chipDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  chipText: { fontFamily: fonts.semiBold, fontSize: 13 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: { flex: 1, alignItems: 'center', borderWidth: 1.5, borderRadius: 14, paddingVertical: 12 },
  pillText: { fontFamily: fonts.semiBold, fontSize: 14 },
  submitBtn: { borderRadius: 28, alignItems: 'center', justifyContent: 'center', minHeight: 54, paddingVertical: 14 },
  submitLabel: { fontFamily: fonts.bold, fontSize: 16, color: '#15202B' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingVertical: 10 },
  deleteLabel: { fontFamily: fonts.semiBold, fontSize: 14 },
  finishedTowerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  resetLink: { fontFamily: fonts.semiBold, fontSize: 13 },
});
