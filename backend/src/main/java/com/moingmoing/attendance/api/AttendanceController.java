package com.moingmoing.attendance.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.attendance.application.AttendanceService;

@RestController
@RequestMapping("/api/v1/gatherings")
class AttendanceController {
    private final AttendanceService attendanceService;

    AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping
    List<GatheringResponse> listGatherings() {
        return attendanceService.findGatherings().stream().map(GatheringResponse::from).toList();
    }

    @PostMapping
    ResponseEntity<GatheringResponse> createGathering(@Valid @RequestBody CreateGatheringRequest request) {
        GatheringResponse response = GatheringResponse.from(attendanceService.createGathering(
                request.heldOn(), request.title(), request.startsAt(), request.location()));
        return ResponseEntity.created(URI.create("/api/v1/gatherings/" + response.id())).body(response);
    }

    @PostMapping("/{id}/open")
    GatheringResponse openGathering(@PathVariable UUID id) {
        return GatheringResponse.from(attendanceService.openGathering(id));
    }

    @PostMapping("/{id}/close")
    GatheringResponse closeGathering(@PathVariable UUID id) {
        return GatheringResponse.from(attendanceService.closeGathering(id));
    }

    @GetMapping("/cancellations")
    CancelledGatheringPageResponse listCancelledGatherings(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        Page<GatheringResponse> result = attendanceService.findCancelledGatherings(page, size)
                .map(GatheringResponse::from);
        return new CancelledGatheringPageResponse(
                result.getContent(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages());
    }

    @PostMapping("/{id}/cancel")
    GatheringResponse cancelGathering(
            @PathVariable UUID id,
            @Valid @RequestBody CancelGatheringRequest request) {
        return GatheringResponse.from(attendanceService.cancelGathering(id, request.cancellationReason()));
    }

    @GetMapping("/{id}/attendances")
    List<AttendanceResponse> listAttendances(@PathVariable UUID id) {
        return attendanceService.findAttendances(id).stream().map(AttendanceResponse::from).toList();
    }

    @PostMapping("/{id}/attendances")
    ResponseEntity<AttendanceResponse> recordAttendance(
            @PathVariable UUID id, @Valid @RequestBody RecordAttendanceRequest request) {
        AttendanceResponse response = AttendanceResponse.from(
                attendanceService.recordAttendance(id, request.memberId(), request.participationType()));
        return ResponseEntity.created(URI.create("/api/v1/gatherings/" + id + "/attendances/" + response.id()))
                .body(response);
    }

    @PostMapping("/{gatheringId}/attendances/{attendanceId}/cancel")
    AttendanceResponse cancelAttendance(
            @PathVariable UUID gatheringId,
            @PathVariable UUID attendanceId,
            @Valid @RequestBody CancelAttendanceRequest request) {
        return AttendanceResponse.from(
                attendanceService.cancelAttendance(gatheringId, attendanceId, request.cancellationReason()));
    }
}
