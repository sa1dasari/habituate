package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    List<Challenge> findByPeriodEndGreaterThanEqualOrderByPeriodStartAsc(LocalDate notBefore);
}
