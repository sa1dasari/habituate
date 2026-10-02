package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {
    List<Challenge> findByPeriodEndGreaterThanEqualOrderByPeriodStartAsc(LocalDate notBefore);

    /** Browse only ever surfaces PUBLIC challenges — PRIVATE ones are reachable by id only (no invite system yet). */
    List<Challenge> findByVisibilityAndPeriodEndGreaterThanEqualOrderByPeriodStartAsc(
            String visibility, LocalDate notBefore);
}
