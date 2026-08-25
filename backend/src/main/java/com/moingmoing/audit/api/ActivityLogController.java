package com.moingmoing.audit.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.audit.application.ActivityLogService;
import com.moingmoing.audit.domain.ActivityLog;

@RestController
@RequestMapping("/api/v1/admin/activity-logs")
class ActivityLogController {
    private final ActivityLogService activityLogService;

    ActivityLogController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @GetMapping
    List<ActivityLogResponse> findRecent() {
        return activityLogService.findRecent().stream().map(ActivityLogResponse::from).toList();
    }

    private record ActivityLogResponse(
            UUID id,
            String actorDisplayName,
            String action,
            String targetType,
            String targetId,
            String requestId,
            String method,
            String path,
            int status,
            Instant occurredAt) {
        private static ActivityLogResponse from(ActivityLog log) {
            return new ActivityLogResponse(
                    log.getId(), log.getActorDisplayName(), log.getAction(), log.getTargetType(),
                    log.getTargetId(), log.getRequestId(), log.getHttpMethod(), log.getRequestPath(),
                    log.getResponseStatus(), log.getOccurredAt());
        }
    }
}
