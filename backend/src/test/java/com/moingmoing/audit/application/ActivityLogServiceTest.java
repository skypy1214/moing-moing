package com.moingmoing.audit.application;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import com.moingmoing.audit.infrastructure.ActivityLogRepository;
import com.moingmoing.auth.infrastructure.UserAccountRepository;

class ActivityLogServiceTest {
    private final ActivityLogRepository activityLogRepository = mock(ActivityLogRepository.class);
    private final ActivityLogService activityLogService = new ActivityLogService(
            activityLogRepository, mock(UserAccountRepository.class));

    @Test
    void findsAllLogsWithoutNullableQueryParameters() {
        PageRequest pageRequest = PageRequest.of(
                0, 20, Sort.by(Sort.Direction.DESC, "occurredAt"));

        activityLogService.findPage(null, null, null, 0, 20);

        verify(activityLogRepository).findAll(pageRequest);
    }

    @Test
    void filtersByActorAndIncludesTheEntireEndDateInKorea() {
        PageRequest pageRequest = PageRequest.of(
                1, 20, Sort.by(Sort.Direction.DESC, "occurredAt"));
        Instant from = Instant.parse("2026-08-01T15:00:00Z");
        Instant until = Instant.parse("2026-08-03T15:00:00Z");

        activityLogService.findPage(
                "staff", LocalDate.of(2026, 8, 2), LocalDate.of(2026, 8, 3), 1, 20);

        verify(activityLogRepository)
                .findByActor_LoginIdAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                        eq("staff"), eq(from), eq(until), eq(pageRequest));
    }
}
