package com.moingmoing.attendance.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "gatherings")
public class Gathering {
    @Id
    private UUID id;
    private LocalDate heldOn;
    @Enumerated(EnumType.STRING)
    private GatheringType gatheringType;
    private LocalDate endsOn;
    private String title;
    private Instant startsAt;
    private String location;
    @Enumerated(EnumType.STRING)
    private GatheringStatus gatheringStatus;
    private Instant cancelledAt;
    private String cancellationReason;
    private Instant createdAt;
    private Instant updatedAt;

    protected Gathering() {
    }

    public Gathering(LocalDate heldOn, String title, Instant startsAt, String location) {
        this(heldOn, GatheringType.CLASS, null, title, startsAt, location);
    }

    public Gathering(
            LocalDate heldOn,
            GatheringType gatheringType,
            LocalDate endsOn,
            String title,
            Instant startsAt,
            String location) {
        this.id = UUID.randomUUID();
        this.heldOn = heldOn;
        updateTypeAndPeriod(gatheringType, endsOn);
        this.title = title;
        this.startsAt = startsAt;
        this.location = location;
        this.gatheringStatus = GatheringStatus.DRAFT;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public LocalDate getHeldOn() {
        return heldOn;
    }

    public GatheringType getGatheringType() {
        return gatheringType;
    }

    public LocalDate getEndsOn() {
        return endsOn;
    }

    public String getTitle() {
        return title;
    }

    public Instant getStartsAt() {
        return startsAt;
    }

    public String getLocation() {
        return location;
    }

    public GatheringStatus getGatheringStatus() {
        return gatheringStatus;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public void open() {
        if (gatheringStatus != GatheringStatus.DRAFT) {
            throw new IllegalArgumentException("초안 상태의 모임만 열 수 있습니다.");
        }
        gatheringStatus = GatheringStatus.OPEN;
        updatedAt = Instant.now();
    }

    public void close() {
        if (gatheringStatus != GatheringStatus.OPEN) {
            throw new IllegalArgumentException("열린 모임만 마감할 수 있습니다.");
        }
        gatheringStatus = GatheringStatus.CLOSED;
        updatedAt = Instant.now();
    }

    public void cancel(String cancellationReason) {
        if (gatheringStatus == GatheringStatus.CLOSED) {
            throw new IllegalArgumentException("마감한 모임은 취소할 수 없습니다.");
        }
        if (gatheringStatus == GatheringStatus.CANCELLED) {
            throw new IllegalArgumentException("이미 취소된 모임입니다.");
        }
        if (cancellationReason == null || cancellationReason.isBlank()) {
            throw new IllegalArgumentException("모임 취소 사유를 입력해 주세요.");
        }
        gatheringStatus = GatheringStatus.CANCELLED;
        cancelledAt = Instant.now();
        this.cancellationReason = cancellationReason.trim();
        updatedAt = Instant.now();
    }

    public void reopen() {
        if (gatheringStatus != GatheringStatus.CLOSED) {
            throw new IllegalArgumentException("Only a closed gathering can be reopened.");
        }
        gatheringStatus = GatheringStatus.OPEN;
        updatedAt = Instant.now();
    }

    public void updateDetails(
            LocalDate heldOn,
            GatheringType gatheringType,
            LocalDate endsOn,
            String title,
            Instant startsAt,
            String location) {
        if (gatheringStatus == GatheringStatus.CANCELLED) {
            throw new IllegalArgumentException("Cancelled gatherings cannot be changed.");
        }
        validateTypeAndPeriod(heldOn, gatheringType, endsOn);
        this.heldOn = heldOn;
        this.gatheringType = gatheringType;
        this.endsOn = endsOn;
        this.title = title;
        this.startsAt = startsAt;
        this.location = location;
        updatedAt = Instant.now();
    }

    private void updateTypeAndPeriod(GatheringType gatheringType, LocalDate endsOn) {
        validateTypeAndPeriod(heldOn, gatheringType, endsOn);
        this.gatheringType = gatheringType;
        this.endsOn = endsOn;
    }

    private void validateTypeAndPeriod(
            LocalDate heldOn, GatheringType gatheringType, LocalDate endsOn) {
        if (heldOn == null) {
            throw new IllegalArgumentException("Gathering date is required.");
        }
        if (gatheringType == null) {
            throw new IllegalArgumentException("Gathering type is required.");
        }
        if (gatheringType == GatheringType.CLASS && endsOn != null) {
            throw new IllegalArgumentException("Classes cannot have an end date.");
        }
        if (gatheringType == GatheringType.EVENT
                && (endsOn == null || endsOn.isBefore(heldOn))) {
            throw new IllegalArgumentException("An event end date must not be before its start date.");
        }
    }
}
