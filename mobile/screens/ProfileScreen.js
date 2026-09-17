import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import HabitCard from '../components/HabitCard';
import InsightCard from '../components/InsightCard';
import ProgressRing from '../components/ProgressRing';
import SharedHabitCard from '../components/SharedHabitCard';
import StreakIndicator from '../components/StreakIndicator';
import { colors, spacing, typography } from '../theme';

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

const SAMPLE_CHECK_INS = [
  { id: 'a', occurredAt: hoursAgo(3) },
  { id: 'b', occurredAt: hoursAgo(27) },
  { id: 'c', occurredAt: hoursAgo(75) },
];

function Section({ title, note, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {note ? <Text style={styles.sectionNote}>{note}</Text> : null}
      {children}
    </View>
  );
}

/**
 * Phase 1 component playground — every shared component in every designed
 * state, so they can be checked against design/ without real data.
 * Replaced by the real profile page in Phase 9.
 */
export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Component playground</Text>
        <Text style={styles.subtitle}>
          Phase 1 reference. The real Profile page ships in Phase 9.
        </Text>

        <Section title="ProgressRing" note="Arc sweep tracks percent, not just colour.">
          <View style={styles.row}>
            <ProgressRing percent={0} size={72} />
            <ProgressRing percent={45} size={72} />
            <ProgressRing percent={100} size={72} color={colors.safe} />
            <ProgressRing percent={60} size={72} label="3/5" caption="today" />
          </View>
        </Section>

        <Section title="StreakIndicator" note="safe / at risk / frozen — no broken state by design.">
          <View style={styles.rowWrap}>
            <StreakIndicator streak={12} status="safe" showLabel />
            <StreakIndicator streak={7} status="at_risk" showLabel />
            <StreakIndicator streak={21} status="frozen" showLabel />
            <StreakIndicator streak={3} status="safe" compact />
          </View>
        </Section>

        <Section title="HabitCard">
          <HabitCard
            name="Drink water"
            category="Health"
            cadenceType="DAILY"
            streak={5}
            streakStatus="safe"
            checked
            onToggle={() => {}}
          />
          <HabitCard
            name="Long run"
            category="Fitness"
            cadenceType="WEEKLY"
            streak={3}
            streakStatus="at_risk"
            onToggle={() => {}}
          />
          <HabitCard
            name="Budget review"
            category="Finance"
            cadenceType="MONTHLY"
            streak={9}
            streakStatus="frozen"
            onToggle={() => {}}
          />
        </Section>

        <Section title="HabitCard — today variant" note="Compact schedule row used on Today.">
          <HabitCard
            variant="today"
            name="Morning coffee"
            category="Nutrition"
            scheduledTime="08:00"
            checked
            onToggle={() => {}}
          />
          <HabitCard
            variant="today"
            name="Read 10 pages"
            category="Learning"
            scheduledTime="12:00"
            onToggle={() => {}}
          />
          <HabitCard
            variant="today"
            name="30 min walk"
            category="Fitness"
            cadenceType="DAILY"
            onToggle={() => {}}
          />
        </Section>

        <Section
          title="HabitCard — period progress + expanded"
          note="Weekly / monthly habits show a bar, and tapping a row reveals when it was logged."
        >
          <HabitCard
            variant="today"
            name="Gym"
            category="Fitness"
            cadenceType="WEEKLY"
            progressLabel="1 of 3 this week"
            periodDone={1}
            periodTarget={3}
            daysLeft={5}
            checkIns={SAMPLE_CHECK_INS}
            checked
            expanded
            onPress={() => {}}
            onToggle={() => {}}
          />
          <HabitCard
            variant="today"
            name="Budget review"
            category="Finance"
            cadenceType="MONTHLY"
            progressLabel="2 of 2 this month — all done"
            progressComplete
            periodDone={2}
            periodTarget={2}
            periodComplete
            daysLeft={14}
            checkIns={SAMPLE_CHECK_INS}
            onPress={() => {}}
            onToggle={() => {}}
          />
        </Section>

        <Section title="InsightCard" note="Conditional frequency only — never causal language.">
          <InsightCard
            habitA="Morning coffee"
            habitB="Morning walk"
            matchPercent={82}
            sampleSize={30}
            nudge="Try queuing your walk right after your coffee this week."
          />
          <InsightCard
            kind="streak_risk"
            habitA="Evening reading"
            habitB="Lights out by 11"
            matchPercent={64}
            description="Your reading streak usually pauses on days you're still up past 11."
          />
        </Section>

        <Section title="SharedHabitCard">
          <SharedHabitCard
            name="Morning run"
            participants={['Sai D', 'Alex P', 'Jordan K', 'Maya R', 'Chris T']}
            participantCount={5}
            streak={14}
            streakStatus="safe"
            rule="all_members"
          />
          <SharedHabitCard
            name="Read 20 pages"
            participants={['Sai D', 'Priya N']}
            streak={6}
            streakStatus="at_risk"
            rule="any_member"
          />
          <SharedHabitCard
            name="Cold plunge"
            participants={['Sai D', 'Alex P', 'Jordan K']}
            streak={31}
            streakStatus="frozen"
            rule="any_member"
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl },
  title: typography.screenTitle,
  subtitle: { ...typography.meta, marginTop: spacing.xs, marginBottom: spacing.xl },
  section: { marginBottom: spacing.xxl },
  sectionTitle: { ...typography.sectionTitle, marginBottom: spacing.xs },
  sectionNote: { ...typography.meta, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
