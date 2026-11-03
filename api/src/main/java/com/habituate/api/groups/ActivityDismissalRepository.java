package com.habituate.api.groups;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityDismissalRepository extends JpaRepository<ActivityDismissal, Long> {
    List<ActivityDismissal> findByUserIdAndCheckInIdIn(String userId, List<Long> checkInIds);

    void deleteByUserId(String userId);

    void deleteByCheckInIdIn(List<Long> checkInIds);
}
