package com.moingmoing.attendance.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.domain.GatheringType;

record GatheringResponse(
        UUID id,
        LocalDate heldOn,
        GatheringType gatheringType,
        LocalDate endsOn,
        String title,
        Instant startsAt,
        String location,
        GatheringStatus gatheringStatus,
        Instant cancelledAt,
        String cancellationReason) {
    static GatheringResponse from(Gathering gathering) {
        return new GatheringResponse(
                gathering.getId(),
                gathering.getHeldOn(),
                gathering.getGatheringType(),
                gathering.getEndsOn(),
                gathering.getTitle(),
                gathering.getStartsAt(),
                gathering.getLocation(),
                gathering.getGatheringStatus(),
                gathering.getCancelledAt(),
                gathering.getCancellationReason());
    }
}

record CancelledGatheringPageResponse(
        java.util.List<GatheringResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}

record AttendanceResponse(
        UUID id,
        UUID gatheringId,
        UUID memberId,
        AttendanceParticipationType participationType,
        AttendanceStatus attendanceStatus,
        Instant recordedAt,
        Instant cancelledAt,
        String cancellationReason) {
    static AttendanceResponse from(Attendance attendance) {
        return new AttendanceResponse(
                attendance.getId(),
                attendance.getGatheringId(),
                attendance.getMemberId(),
                attendance.getParticipationType(),
                attendance.getAttendanceStatus(),
                attendance.getRecordedAt(),
                attendance.getCancelledAt(),
                attendance.getCancellationReason());
    }
}
