package com.moingmoing.audit.infrastructure;

import java.time.Instant;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.audit.domain.ActivityLog;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {
    Page<ActivityLog> findByActor_LoginId(String actorLoginId, Pageable pageable);

    Page<ActivityLog> findByActor_LoginIdAndOccurredAtGreaterThanEqual(
            String actorLoginId, Instant from, Pageable pageable);

    Page<ActivityLog> findByActor_LoginIdAndOccurredAtLessThan(
            String actorLoginId, Instant until, Pageable pageable);

    Page<ActivityLog> findByActor_LoginIdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
            String actorLoginId, Instant from, Instant until, Pageable pageable);

    Page<ActivityLog> findByOccurredAtGreaterThanEqual(Instant from, Pageable pageable);

    Page<ActivityLog> findByOccurredAtLessThan(Instant until, Pageable pageable);

    Page<ActivityLog> findByOccurredAtGreaterThanEqualAndOccurredAtLessThan(
            Instant from, Instant until, Pageable pageable);
}
