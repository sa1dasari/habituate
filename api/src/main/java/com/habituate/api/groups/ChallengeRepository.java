package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, Long> {

    /** Browse only ever surfaces PUBLIC challenges — PRIVATE ones are reachable by id only (no invite system yet).
     * A null periodEnd is open-ended, so it always qualifies rather than being excluded by the >= comparison. */
    @Query("select c from Challenge c where c.visibility = :visibility "
            + "and (c.periodEnd is null or c.periodEnd >= :notBefore) order by c.periodStart asc")
    List<Challenge> findBrowsable(@Param("visibility") String visibility, @Param("notBefore") LocalDate notBefore);

    /** Reminder sweep only needs challenges still running today (open-ended ones always qualify). */
    @Query("select c from Challenge c where c.reminderTime is not null and c.periodStart <= :today "
            + "and (c.periodEnd is null or c.periodEnd >= :today)")
    List<Challenge> findWithActiveReminder(@Param("today") LocalDate today);

    List<Challenge> findByCreatedBy(String createdBy);
}
