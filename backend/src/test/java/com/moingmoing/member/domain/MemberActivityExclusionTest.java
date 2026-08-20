package com.moingmoing.member.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class MemberActivityExclusionTest {
    @Test
    void supportsAnOpenEndedExclusionAndCanCloseIt() {
        MemberActivityExclusion exclusion = new MemberActivityExclusion(
                UUID.randomUUID(), ActivityExclusionReason.PERSONAL_BREAK, LocalDate.of(2026, 1, 1), null);

        exclusion.close(LocalDate.of(2026, 1, 31));

        assertThat(exclusion.getEndDate()).isEqualTo(LocalDate.of(2026, 1, 31));
    }

    @Test
    void rejectsAnEndDateBeforeTheStartDate() {
        MemberActivityExclusion exclusion = new MemberActivityExclusion(
                UUID.randomUUID(), ActivityExclusionReason.MEDICAL, LocalDate.of(2026, 2, 1), null);

        assertThatThrownBy(() -> exclusion.close(LocalDate.of(2026, 1, 31)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void updatesReasonPeriodAndNoteWithoutReplacingTheHistoryRecord() {
        MemberActivityExclusion exclusion = new MemberActivityExclusion(
                UUID.randomUUID(), ActivityExclusionReason.PERSONAL_BREAK, LocalDate.of(2026, 2, 1), null);

        exclusion.update(
                ActivityExclusionReason.MEDICAL,
                LocalDate.of(2026, 2, 3),
                LocalDate.of(2026, 2, 28),
                "치료 일정");

        assertThat(exclusion.getReason()).isEqualTo(ActivityExclusionReason.MEDICAL);
        assertThat(exclusion.getStartDate()).isEqualTo(LocalDate.of(2026, 2, 3));
        assertThat(exclusion.getEndDate()).isEqualTo(LocalDate.of(2026, 2, 28));
        assertThat(exclusion.getNote()).isEqualTo("치료 일정");
    }
}
