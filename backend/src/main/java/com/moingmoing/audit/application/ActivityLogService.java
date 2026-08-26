package com.moingmoing.audit.application;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Service;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.audit.domain.ActivityLog;
import com.moingmoing.audit.infrastructure.ActivityLogRepository;
import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.infrastructure.UserAccountRepository;

@Service
public class ActivityLogService {
    private static final ZoneId KOREA_ZONE_ID = ZoneId.of("Asia/Seoul");
    private final ActivityLogRepository activityLogRepository;
    private final UserAccountRepository userAccountRepository;

    public ActivityLogService(
            ActivityLogRepository activityLogRepository,
            UserAccountRepository userAccountRepository) {
        this.activityLogRepository = activityLogRepository;
        this.userAccountRepository = userAccountRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            String loginId,
            String action,
            String targetType,
            String targetId,
            String requestId,
            String method,
            String path,
            int status) {
        UserAccount actor = loginId == null ? null : userAccountRepository.findByLoginId(loginId).orElse(null);
        activityLogRepository.save(new ActivityLog(
                actor, action, targetType, targetId, requestId, method, path, status));
    }

    @Transactional(readOnly = true)
    public Page<ActivityLog> findPage(
            String actorLoginId, LocalDate fromDate, LocalDate toDate, int page, int size) {
        if (fromDate != null && toDate != null && fromDate.isAfter(toDate)) {
            throw new IllegalArgumentException("시작일은 종료일보다 늦을 수 없습니다.");
        }
        Instant from = fromDate == null ? null : fromDate.atStartOfDay(KOREA_ZONE_ID).toInstant();
        Instant until = toDate == null
                ? null
                : toDate.plusDays(1).atStartOfDay(KOREA_ZONE_ID).toInstant();
        PageRequest pageRequest = PageRequest.of(
                page, size, Sort.by(Sort.Direction.DESC, "occurredAt"));
        String normalizedActorLoginId = actorLoginId == null || actorLoginId.isBlank()
                ? null
                : actorLoginId;
        if (normalizedActorLoginId != null) {
            if (from != null && until != null) {
                return activityLogRepository.findByActor_LoginIdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                        normalizedActorLoginId, from, until, pageRequest);
            }
            if (from != null) {
                return activityLogRepository.findByActor_LoginIdAndOccurredAtGreaterThanEqual(
                        normalizedActorLoginId, from, pageRequest);
            }
            if (until != null) {
                return activityLogRepository.findByActor_LoginIdAndOccurredAtLessThan(
                        normalizedActorLoginId, until, pageRequest);
            }
            return activityLogRepository.findByActor_LoginId(normalizedActorLoginId, pageRequest);
        }
        if (from != null && until != null) {
            return activityLogRepository.findByOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                    from, until, pageRequest);
        }
        if (from != null) {
            return activityLogRepository.findByOccurredAtGreaterThanEqual(from, pageRequest);
        }
        if (until != null) {
            return activityLogRepository.findByOccurredAtLessThan(until, pageRequest);
        }
        return activityLogRepository.findAll(pageRequest);
    }
}
