package com.moingmoing.member.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "member_activity_exclusions")
public class MemberActivityExclusion {
    @Id
    private UUID id;
    private UUID memberId;
    @Enumerated(EnumType.STRING)
    private ActivityExclusionReason reason;
    private LocalDate startDate;
    private LocalDate endDate;
    private String note;
    private Instant createdAt;
    private Instant updatedAt;

    protected MemberActivityExclusion() {
    }

    public MemberActivityExclusion(UUID memberId, ActivityExclusionReason reason, LocalDate startDate, String note) {
        this(memberId, reason, startDate, null, note);
    }

    public MemberActivityExclusion(
            UUID memberId,
            ActivityExclusionReason reason,
            LocalDate startDate,
            LocalDate endDate,
            String note) {
        this.id = UUID.randomUUID();
        this.memberId = memberId;
        this.reason = reason;
        this.startDate = startDate;
        this.endDate = endDate;
        this.note = note;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getMemberId() { return memberId; }
    public ActivityExclusionReason getReason() { return reason; }
    public LocalDate getStartDate() { return startDate; }
    public LocalDate getEndDate() { return endDate; }
    public String getNote() { return note; }

    public void close(LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("종료일은 시작일보다 이를 수 없습니다.");
        }
        this.endDate = endDate;
        updatedAt = Instant.now();
    }

    public void update(
            ActivityExclusionReason reason, LocalDate startDate, LocalDate endDate, String note) {
        if (endDate != null && endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("종료일은 시작일보다 이를 수 없습니다.");
        }
        this.reason = reason;
        this.startDate = startDate;
        this.endDate = endDate;
        this.note = note;
        updatedAt = Instant.now();
    }
}
