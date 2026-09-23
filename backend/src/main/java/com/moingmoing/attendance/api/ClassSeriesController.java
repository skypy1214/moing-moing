package com.moingmoing.attendance.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.attendance.application.ClassSeriesService;
import com.moingmoing.attendance.domain.ClassSeries;
import com.moingmoing.attendance.domain.ClassSeriesEnrollment;

@RestController
@RequestMapping("/api/v1/class-series")
class ClassSeriesController {
    private final ClassSeriesService classSeriesService;

    ClassSeriesController(ClassSeriesService classSeriesService) {
        this.classSeriesService = classSeriesService;
    }

    @PostMapping
    ResponseEntity<ClassSeriesResponse> create(@Valid @RequestBody CreateClassSeriesRequest request) {
        ClassSeriesService.CreatedClassSeries created = classSeriesService.create(
                request.startsOn(),
                request.hostMemberId(),
                request.title(),
                request.location(),
                request.sessionFee(),
                request.sessionCount());
        return ResponseEntity.created(URI.create("/api/v1/class-series/" + created.series().getId()))
                .body(ClassSeriesResponse.from(created.series(), created.gatherings()));
    }

    @PostMapping("/convert-existing")
    ResponseEntity<ClassSeriesResponse> convertExisting(
            @Valid @RequestBody ConvertExistingClassSeriesRequest request) {
        ClassSeriesService.CreatedClassSeries converted = classSeriesService.convertExisting(
                request.gatheringIds(),
                request.title(),
                request.sessionFee(),
                request.prepaidMemberIds());
        return ResponseEntity.created(URI.create("/api/v1/class-series/" + converted.series().getId()))
                .body(ClassSeriesResponse.from(converted.series(), converted.gatherings()));
    }

    @GetMapping("/{seriesId}")
    ClassSeriesResponse find(@PathVariable UUID seriesId) {
        ClassSeries series = classSeriesService.findById(seriesId);
        return ClassSeriesResponse.from(series, List.of());
    }

    @GetMapping("/{seriesId}/enrollments")
    List<ClassSeriesEnrollmentResponse> listEnrollments(@PathVariable UUID seriesId) {
        return classSeriesService.findEnrollments(seriesId).stream()
                .map(ClassSeriesEnrollmentResponse::from)
                .toList();
    }

    @PostMapping("/{seriesId}/enrollments")
    ResponseEntity<ClassSeriesEnrollmentResponse> enroll(
            @PathVariable UUID seriesId,
            @Valid @RequestBody CreateClassSeriesEnrollmentRequest request) {
        ClassSeriesEnrollment enrollment = classSeriesService.enroll(
                seriesId, request.memberId(), request.paidAmount());
        return ResponseEntity.created(URI.create(
                        "/api/v1/class-series/" + seriesId + "/enrollments/" + enrollment.getId()))
                .body(ClassSeriesEnrollmentResponse.from(enrollment));
    }
}

record CreateClassSeriesRequest(
        @NotNull LocalDate startsOn,
        UUID hostMemberId,
        @NotBlank String title,
        String location,
        @PositiveOrZero int sessionFee,
        @Min(2) @Max(24) int sessionCount) {
}

record CreateClassSeriesEnrollmentRequest(
        @NotNull UUID memberId,
        @PositiveOrZero Integer paidAmount) {
}

record ConvertExistingClassSeriesRequest(
        @NotNull @jakarta.validation.constraints.Size(min = 2, max = 24) List<UUID> gatheringIds,
        @NotBlank String title,
        @PositiveOrZero int sessionFee,
        @NotNull List<UUID> prepaidMemberIds) {
}

record ClassSeriesResponse(
        UUID id,
        String title,
        LocalDate startsOn,
        int sessionCount,
        int sessionFee,
        int totalFee,
        List<GatheringResponse> gatherings) {
    static ClassSeriesResponse from(ClassSeries series, List<com.moingmoing.attendance.domain.Gathering> gatherings) {
        return new ClassSeriesResponse(
                series.getId(),
                series.getTitle(),
                series.getStartsOn(),
                series.getSessionCount(),
                series.getSessionFee(),
                series.getTotalFee(),
                gatherings.stream().map(GatheringResponse::from).toList());
    }
}

record ClassSeriesEnrollmentResponse(
        UUID id,
        UUID classSeriesId,
        UUID memberId,
        int paidAmount,
        LocalDate paidOn) {
    static ClassSeriesEnrollmentResponse from(ClassSeriesEnrollment enrollment) {
        return new ClassSeriesEnrollmentResponse(
                enrollment.getId(),
                enrollment.getClassSeriesId(),
                enrollment.getMemberId(),
                enrollment.getPaidAmount(),
                enrollment.getPaidOn());
    }
}
