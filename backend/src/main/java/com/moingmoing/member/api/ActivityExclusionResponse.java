package com.moingmoing.member.api;

import java.time.LocalDate;
import java.util.UUID;

import com.moingmoing.member.domain.ActivityExclusionReason;
import com.moingmoing.member.domain.MemberActivityExclusion;

record ActivityExclusionResponse(
        UUID id, ActivityExclusionReason reason, LocalDate startDate, LocalDate endDate, String note) {
    static ActivityExclusionResponse from(MemberActivityExclusion exclusion) {
        return new ActivityExclusionResponse(
                exclusion.getId(),
                exclusion.getReason(),
                exclusion.getStartDate(),
                exclusion.getEndDate(),
                exclusion.getNote());
    }
}
