package com.moingmoing.audit.infrastructure;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.audit.domain.ActivityLog;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {
}
