package com.moingmoing.audit.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
    ActivityLogPageResponse findPage(
            @RequestParam(required = false) String actorLoginId,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int size) {
        Page<ActivityLogResponse> result = activityLogService
                .findPage(actorLoginId, fromDate, toDate, page, size)
                .map(ActivityLogResponse::from);
        return new ActivityLogPageResponse(
                result.getContent(), result.getNumber(), result.getSize(),
                result.getTotalElements(), result.getTotalPages());
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

    private record ActivityLogPageResponse(
            List<ActivityLogResponse> items,
            int page,
            int size,
            long totalElements,
            int totalPages) {
    }
}
