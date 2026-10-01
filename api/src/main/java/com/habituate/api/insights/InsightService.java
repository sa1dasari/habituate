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

        for (Habit a : habits) {
            for (Habit b : habits) {
                if (a.getId().equals(b.getId())) continue;

                CorrelationEngine.PairResult result = CorrelationEngine.correlate(
                        completedDaysByHabit.get(a.getId()), completedDaysByHabit.get(b.getId()));

                upsertCorrelation(userId, a.getId(), b.getId(), result);

                if (result.sampleSize() >= MIN_SAMPLE_SIZE && result.score() >= MIN_SCORE) {
                    upsertInsight(userId, a, b, result);
                }
            }
        }
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
