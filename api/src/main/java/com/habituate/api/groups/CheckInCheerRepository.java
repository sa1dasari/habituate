package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CheckInCheerRepository extends JpaRepository<CheckInCheer, Long> {
    Optional<CheckInCheer> findByCheckInIdAndUserId(Long checkInId, String userId);

    List<CheckInCheer> findByCheckInIdIn(List<Long> checkInIds);
}
