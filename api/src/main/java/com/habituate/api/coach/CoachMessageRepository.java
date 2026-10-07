package com.habituate.api.coach;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CoachMessageRepository extends JpaRepository<CoachMessage, Long> {
    List<CoachMessage> findByUserIdOrderByCreatedAtAsc(String userId);

    void deleteByUserId(String userId);
}
