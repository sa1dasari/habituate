package com.habituate.api.insights;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.habituate.api.checkins.CheckIn;
import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.common.ForbiddenException;
import com.habituate.api.habits.Habit;
import com.habituate.api.habits.HabitRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Phase 5's "simple, batch" insights engine — a plain scheduled recompute,
 * no Flink. See CLAUDE.md: the "real-time" part Phase 6 adds is that the
 * pipeline becomes event-triggered, not that per-event math suddenly becomes
 * meaningful; check-ins are sparse, so correlation quality still depends on
 * weeks of accumulated data either way.
 */
@Service
public class InsightService {

    static final int WINDOW_DAYS = 30;

    /** Don't call three data points a "90% match" — see CLAUDE.md's Insights screen rule. */
    static final int MIN_SAMPLE_SIZE = 5;

    /** Below this, a pairing isn't really a "pattern detected" — it's noise. */
    static final double MIN_SCORE = 0.6;

    /**
     * Below this, B isn't actually more likely on an A-day than on an
     * arbitrary day — it's just a habit that happens to be frequent on its
     * own. Without this, two unrelated-but-both-frequent habits (e.g. gym
     * and job applications, each done most days) show a high raw match
     * purely from coincidence, not because completing one predicts the
     * other. 1.3 means "at least 30% more likely than B's own baseline."
     */
    static final double MIN_LIFT = 1.3;

    private final HabitRepository habitRepository;
    private final CheckInRepository checkInRepository;
    private final CorrelationRepository correlationRepository;
    private final InsightRepository insightRepository;
    private final ObjectMapper objectMapper;

    public InsightService(
            HabitRepository habitRepository,
            CheckInRepository checkInRepository,
            CorrelationRepository correlationRepository,
            InsightRepository insightRepository,
            ObjectMapper objectMapper) {
        this.habitRepository = habitRepository;
        this.checkInRepository = checkInRepository;
        this.correlationRepository = correlationRepository;
        this.insightRepository = insightRepository;
        this.objectMapper = objectMapper;
    }

    /** Entry point for the nightly scheduler — only bothers with users who've actually logged something recently. */
    public void computeForAllUsers() {
        Instant since = Instant.now().minus(WINDOW_DAYS, ChronoUnit.DAYS);
        for (String userId : checkInRepository.findDistinctUserIdsSince(since)) {
            computeForUser(userId);
        }
    }

    @Transactional
    public void computeForUser(String userId) {
        List<Habit> habits = habitRepository.findByUserIdAndArchivedFalseOrderByCreatedAtDesc(userId);
        if (habits.size() < 2) {
            return;
        }

        Instant since = Instant.now().minus(WINDOW_DAYS, ChronoUnit.DAYS);
        Map<Long, Set<LocalDate>> completedDaysByHabit = new HashMap<>();
        for (Habit habit : habits) {
            List<CheckIn> checkIns = checkInRepository.findByUserIdAndHabitIdOrderByOccurredAtAsc(userId, habit.getId());
            completedDaysByHabit.put(habit.getId(), CorrelationEngine.completedDays(habit, checkIns, since));
        }

        // Unordered pairs — both directions are computed and stored as
        // correlations (CLAUDE.md: "store both directions if both are
        // statistically meaningful, don't assume symmetry"), but only the
        // stronger-qualifying direction becomes a user-facing insight. A→B
        // and B→A showing up as two separate "pattern detected" cards for
        // the same two habits read as redundant noise, not two patterns.
        for (int i = 0; i < habits.size(); i++) {
            for (int j = i + 1; j < habits.size(); j++) {
                Habit a = habits.get(i);
                Habit b = habits.get(j);
                Set<LocalDate> daysA = completedDaysByHabit.get(a.getId());
                Set<LocalDate> daysB = completedDaysByHabit.get(b.getId());

                CorrelationEngine.PairResult aToB = CorrelationEngine.correlate(daysA, daysB, WINDOW_DAYS);
                CorrelationEngine.PairResult bToA = CorrelationEngine.correlate(daysB, daysA, WINDOW_DAYS);

                upsertCorrelation(userId, a.getId(), b.getId(), aToB);
                upsertCorrelation(userId, b.getId(), a.getId(), bToA);

                boolean aToBQualifies = qualifies(aToB);
                boolean bToAQualifies = qualifies(bToA);

                if (aToBQualifies && bToAQualifies) {
                    // Both directions clear the bar — surface only the
                    // stronger one (by lift, since that's what distinguishes
                    // a real pattern from base-rate noise) rather than both.
                    if (aToB.lift() >= bToA.lift()) {
                        removeActiveInsightIfPresent(userId, b.getId(), a.getId());
                        upsertInsight(userId, a, b, aToB);
                    } else {
                        removeActiveInsightIfPresent(userId, a.getId(), b.getId());
                        upsertInsight(userId, b, a, bToA);
                    }
                } else if (aToBQualifies) {
                    // The opposite direction may have been the surfaced one
                    // on a previous run — if the stronger direction flipped,
                    // clear it instead of leaving an orphaned, now-superseded
                    // insight that nothing will ever touch again.
                    removeActiveInsightIfPresent(userId, b.getId(), a.getId());
                    upsertInsight(userId, a, b, aToB);
                } else if (bToAQualifies) {
                    removeActiveInsightIfPresent(userId, a.getId(), b.getId());
                    upsertInsight(userId, b, a, bToA);
                } else {
                    // Neither direction qualifies (any more) — actively clear
                    // a previously-surfaced insight for this pair rather than
                    // leaving it to rot. This matters in practice, not just
                    // in theory: tightening MIN_LIFT after it shipped needs
                    // the next recompute to retract patterns that no longer
                    // clear the new bar, not just stop minting new ones.
                    removeActiveInsightIfPresent(userId, a.getId(), b.getId());
                    removeActiveInsightIfPresent(userId, b.getId(), a.getId());
                }
            }
        }
    }

    private boolean qualifies(CorrelationEngine.PairResult result) {
        return result.sampleSize() >= MIN_SAMPLE_SIZE
                && result.score() >= MIN_SCORE
                && result.lift() >= MIN_LIFT;
    }

    private void upsertCorrelation(String userId, Long habitAId, Long habitBId, CorrelationEngine.PairResult result) {
        Correlation correlation = correlationRepository
                .findByUserIdAndHabitAIdAndHabitBIdAndWindowDays(userId, habitAId, habitBId, WINDOW_DAYS)
                .orElseGet(() -> new Correlation(userId, habitAId, habitBId, WINDOW_DAYS, 0.0, 0, Instant.now()));
        correlation.setScore(result.score());
        correlation.setSampleSize(result.sampleSize());
        correlation.setComputedAt(Instant.now());
        correlationRepository.save(correlation);
    }

    /**
     * Clears a still-active (non-dismissed) insight for the losing direction
     * of a pair when the other direction is the one being surfaced instead —
     * it's being replaced by a more-correct reading of the same two habits,
     * not lost information, so this doesn't need to respect a dismissal the
     * way upsertInsight does for its own direction.
     */
    private void removeActiveInsightIfPresent(String userId, Long habitAId, Long habitBId) {
        insightRepository.findByUserIdAndTypeAndHabitAIdAndHabitBId(userId, Insight.TYPE_CORRELATION, habitAId, habitBId)
                .filter(insight -> insight.getDismissedAt() == null)
                .ifPresent(insightRepository::delete);
    }

    private void upsertInsight(String userId, Habit a, Habit b, CorrelationEngine.PairResult result) {
        Optional<Insight> existing = insightRepository.findByUserIdAndTypeAndHabitAIdAndHabitBId(
                userId, Insight.TYPE_CORRELATION, a.getId(), b.getId());

        // Respect a dismissal — recomputing the same stat shouldn't resurrect
        // a card the user already dismissed.
        if (existing.isPresent() && existing.get().getDismissedAt() != null) {
            return;
        }

        Insight insight = existing.orElseGet(() -> {
            Insight fresh = new Insight();
            fresh.setUserId(userId);
            fresh.setType(Insight.TYPE_CORRELATION);
            fresh.setHabitAId(a.getId());
            fresh.setHabitBId(b.getId());
            return fresh;
        });
        insight.setPayload(buildPayload(a, b, result));
        insight.setGeneratedAt(Instant.now());
        insightRepository.save(insight);
    }

    private String buildPayload(Habit a, Habit b, CorrelationEngine.PairResult result) {
        int percent = Math.round((float) (result.score() * 100));

        // Non-causal, conditional-frequency framing only — never "X causes/helps Y". See CLAUDE.md.
        String description = String.format(
                "You complete %s on %d%% of the days you complete %s.",
                b.getName(), percent, a.getName());
        String nudge = String.format(
                "Try logging %s right after %s to keep the pattern going.",
                b.getName(), a.getName());

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("habitAId", a.getId());
        payload.put("habitBId", b.getId());
        payload.put("habitAName", a.getName());
        payload.put("habitBName", b.getName());
        payload.put("matchPercent", percent);
        payload.put("sampleSize", result.sampleSize());
        payload.put("windowDays", WINDOW_DAYS);
        payload.put("lift", Math.round(result.lift() * 100) / 100.0);
        payload.put("description", description);
        payload.put("nudge", nudge);

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize insight payload", e);
        }
    }

    public List<Insight> listActive(String userId) {
        return insightRepository.findByUserIdAndDismissedAtIsNullOrderByGeneratedAtDesc(userId);
    }

    @Transactional
    public void dismiss(String userId, Long insightId) {
        Insight insight = insightRepository.findById(insightId)
                .orElseThrow(() -> new EntityNotFoundException("Insight not found: " + insightId));

        if (!userId.equals(insight.getUserId())) {
            throw new ForbiddenException("Insight does not belong to user: " + userId);
        }

        insight.setDismissedAt(Instant.now());
        insightRepository.save(insight);
    }
}
