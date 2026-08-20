package com.moingmoing.member.api;

import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.moingmoing.member.domain.ActivityExclusionReason;

record CreateMemberRequest(
        @NotBlank @Size(max = 100) String displayName,
        @Size(max = 100) String externalNickname,
        @NotNull LocalDate joinedOn,
        @Size(max = 1000) String memo) {
}

record UpdateMemberRequest(
        @NotBlank @Size(max = 100) String displayName,
        @Size(max = 100) String externalNickname,
        @NotNull LocalDate joinedOn,
        @Size(max = 1000) String memo) {
}

record ChangeMembershipDateRequest(@NotNull LocalDate date) {
}

record StartActivityExclusionRequest(
        @NotNull ActivityExclusionReason reason,
        @NotNull LocalDate startDate,
        @Size(max = 1000) String note) {
}

record EndActivityExclusionRequest(@NotNull LocalDate endDate) {
}

record UpdateActivityExclusionRequest(
        @NotNull ActivityExclusionReason reason,
        @NotNull LocalDate startDate,
        LocalDate endDate,
        @Size(max = 1000) String note) {
}
