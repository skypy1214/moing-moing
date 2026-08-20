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
    private String title;
    private Instant startsAt;
    private String location;
    @Enumerated(EnumType.STRING)
    private GatheringStatus gatheringStatus;
    private Instant createdAt;
    private Instant updatedAt;

    protected Gathering() {
    }

    public Gathering(LocalDate heldOn, String title, Instant startsAt, String location) {
        this.id = UUID.randomUUID();
        this.heldOn = heldOn;
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

    public void cancel() {
        if (gatheringStatus == GatheringStatus.CLOSED) {
            throw new IllegalArgumentException("마감한 모임은 취소할 수 없습니다.");
        }
        gatheringStatus = GatheringStatus.CANCELLED;
        updatedAt = Instant.now();
    }
}
