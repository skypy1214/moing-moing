package com.moingmoing.attendance.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.moingmoing.attendance.domain.AttendanceParticipationType;

record CreateGatheringRequest(
        @NotNull LocalDate heldOn,
        @Size(max = 200) String title,
        Instant startsAt,
        @Size(max = 200) String location) {
}

record RecordAttendanceRequest(
        @NotNull UUID memberId,
        @NotNull AttendanceParticipationType participationType) {
}

record CancelAttendanceRequest(@NotBlank @Size(max = 1000) String cancellationReason) {
}

record CancelGatheringRequest(@NotBlank @Size(max = 1000) String cancellationReason) {
}
