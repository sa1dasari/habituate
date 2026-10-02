package com.habituate.api.groups;

import com.habituate.api.checkins.CheckInRepository;
import com.habituate.api.events.CheckInEvent;
import com.habituate.api.events.KafkaTopicConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

/**
 * Per CLAUDE.md: "a group is just a filtered consumer of the same events,
 * not a separate pipeline" — this listens on the same checkin-events topic
 * CheckInEventLogger already does, filtering to events whose check-in
 * belongs to a group-linked habit. Needs its own Kafka consumer groupId
 * (confirmed via exploration: the global spring.kafka.consumer.group-id is
 * already claimed by the logger) so the two listeners independently see
 * every message instead of competing for partitions within one group.
 *
 * No @Transactional here: this only ever does one GroupStreak upsert per
 * event, so there's nothing needing cross-entity atomicity — and putting
 * @Transactional on a method this class calls via `this.` (self-invocation)
 * would silently bypass the proxy anyway, a mistake already made and fixed
 * once this session in HabitService.
 */
@Component
public class GroupStreakConsumer {

    private static final Logger log = LoggerFactory.getLogger(GroupStreakConsumer.class);

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupStreakRepository groupStreakRepository;
    private final CheckInRepository checkInRepository;

    public GroupStreakConsumer(
            GroupRepository groupRepository,
            GroupMemberRepository groupMemberRepository,
            GroupStreakRepository groupStreakRepository,
            CheckInRepository checkInRepository) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupStreakRepository = groupStreakRepository;
        this.checkInRepository = checkInRepository;
    }

    @KafkaListener(topics = KafkaTopicConfig.CHECKIN_EVENTS_TOPIC, groupId = "habituate-api-group-streak-consumer")
    public void onCheckInEvent(CheckInEvent event) {
        if (event.groupId() == null) {
            return;
        }
        recomputeGroupStreak(event.groupId());
    }

    /** Public so it can be called directly from tests (and reused by anything else that needs an on-demand recompute). */
    public void recomputeGroupStreak(Long groupId) {
        Group group = groupRepository.findById(groupId).orElse(null);
        if (group == null) {
            log.warn("Group {} not found during streak recompute — skipping", groupId);
            return;
        }

        List<GroupMember> activeMembers = groupMemberRepository.findByGroupIdAndStatus(groupId, GroupMember.ACTIVE);
        if (activeMembers.isEmpty()) {
            return;
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        Instant dayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();

        List<Boolean> completedToday = new ArrayList<>();
        for (GroupMember member : activeMembers) {
            completedToday.add(checkInRepository.existsByHabitIdAndOccurredAtBetween(member.getHabitId(), dayStart, dayEnd));
        }

        boolean qualifies = GroupStreakEngine.qualifies(group.getStreakRule(), completedToday);

        GroupStreak streak = groupStreakRepository.findById(groupId).orElseGet(() -> new GroupStreak(groupId));
        GroupStreakEngine.Result result = GroupStreakEngine.recompute(
                qualifies, streak.getCurrentStreak(), streak.getLongestStreak(), streak.getLastQualifyingDate(), today);

        streak.setCurrentStreak(result.currentStreak());
        streak.setLongestStreak(result.longestStreak());
        streak.setLastQualifyingDate(result.lastQualifyingDate());
        streak.setStatus(result.status());
        streak.setUpdatedAt(Instant.now());
        groupStreakRepository.save(streak);
    }
}
