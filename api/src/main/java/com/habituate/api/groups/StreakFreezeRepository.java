package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StreakFreezeRepository extends JpaRepository<StreakFreeze, Long> {
    List<StreakFreeze> findByGroupIdAndUsedOnDateAfter(Long groupId, LocalDate after);
}
