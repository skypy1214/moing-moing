package com.moingmoing.attendance.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Records one member's paid prepayment for a class series. Refunds remain a manual settlement action. */
@Entity
@Table(name = "class_series_enrollments")
public class ClassSeriesEnrollment {
    @Id
    private UUID id;
    private UUID classSeriesId;
    private UUID memberId;
    private int paidAmount;
    private LocalDate paidOn;
    private Instant createdAt;
    private Instant updatedAt;

    protected ClassSeriesEnrollment() {
    }

    public ClassSeriesEnrollment(UUID classSeriesId, UUID memberId, int paidAmount, LocalDate paidOn) {
        if (classSeriesId == null || memberId == null) {
            throw new IllegalArgumentException("선납 수업과 회원은 필수입니다.");
        }
        if (paidAmount < 0) {
            throw new IllegalArgumentException("선납 금액은 0원 이상이어야 합니다.");
        }
        if (paidOn == null) {
            throw new IllegalArgumentException("입금일을 입력해 주세요.");
        }
        this.id = UUID.randomUUID();
        this.classSeriesId = classSeriesId;
        this.memberId = memberId;
        this.paidAmount = paidAmount;
        this.paidOn = paidOn;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getClassSeriesId() { return classSeriesId; }
    public UUID getMemberId() { return memberId; }
    public int getPaidAmount() { return paidAmount; }
    public LocalDate getPaidOn() { return paidOn; }
}
