package com.moingmoing.audit.application;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.audit.domain.ActivityLog;
import com.moingmoing.audit.infrastructure.ActivityLogRepository;
import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.infrastructure.UserAccountRepository;

@Service
public class ActivityLogService {
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
    public List<ActivityLog> findRecent() {
        return activityLogRepository.findAll(org.springframework.data.domain.PageRequest.of(
                0,
                200,
                org.springframework.data.domain.Sort.by(
                        org.springframework.data.domain.Sort.Direction.DESC, "occurredAt"))).getContent();
    }
}
