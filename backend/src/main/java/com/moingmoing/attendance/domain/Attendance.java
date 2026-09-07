package com.moingmoing.attendance.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "attendances")
public class Attendance {
    @Id
    private UUID id;
    private UUID gatheringId;
    private UUID memberId;
    @Enumerated(EnumType.STRING)
    private AttendanceParticipationType participationType;
    @Enumerated(EnumType.STRING)
    private AttendanceStatus attendanceStatus;
    private Instant recordedAt;
    private Instant cancelledAt;
    private String cancellationReason;
    private int appliedFee;
    @Enumerated(EnumType.STRING)
    private AttendancePaymentStatus paymentStatus;
    private Instant paidAt;
    private boolean feeOverridden;
    private Instant createdAt;
    private Instant updatedAt;

    protected Attendance() {
    }

    public Attendance(UUID gatheringId, UUID memberId, AttendanceParticipationType participationType) {
        this(gatheringId, memberId, participationType, 0);
    }

    public Attendance(
            UUID gatheringId,
            UUID memberId,
            AttendanceParticipationType participationType,
            int appliedFee) {
        if (appliedFee < 0) {
            throw new IllegalArgumentException("Applied fee must not be negative.");
        }
        this.id = UUID.randomUUID();
        this.gatheringId = gatheringId;
        this.memberId = memberId;
        this.participationType = participationType;
        this.attendanceStatus = AttendanceStatus.RECORDED;
        this.appliedFee = appliedFee;
        this.paymentStatus = appliedFee == 0
                ? AttendancePaymentStatus.EXEMPT
                : AttendancePaymentStatus.PENDING;
        this.feeOverridden = false;
        this.recordedAt = Instant.now();
        this.createdAt = recordedAt;
        this.updatedAt = recordedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getGatheringId() {
        return gatheringId;
    }

    public UUID getMemberId() {
        return memberId;
    }

    public AttendanceParticipationType getParticipationType() {
        return participationType;
    }

    public AttendanceStatus getAttendanceStatus() {
        return attendanceStatus;
    }

    public Instant getRecordedAt() {
        return recordedAt;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }

    public String getCancellationReason() {
        return cancellationReason;
    }

    public int getAppliedFee() {
        return appliedFee;
    }

    public AttendancePaymentStatus getPaymentStatus() {
        return paymentStatus;
    }

    public Instant getPaidAt() {
        return paidAt;
    }

    public boolean isFeeOverridden() {
        return feeOverridden;
    }

    public void updatePayment(int appliedFee, AttendancePaymentStatus paymentStatus) {
        if (appliedFee < 0) {
            throw new IllegalArgumentException("적용 참가비는 0원 이상이어야 합니다.");
        }
        if (paymentStatus == null) {
            throw new IllegalArgumentException("입금 상태를 선택해 주세요.");
        }
        if (appliedFee > 0 && paymentStatus == AttendancePaymentStatus.EXEMPT) {
            throw new IllegalArgumentException("면제 상태의 참가비는 0원이어야 합니다.");
        }
        if (paymentStatus == AttendancePaymentStatus.PAID && appliedFee == 0) {
            throw new IllegalArgumentException("0원 참가비는 입금 완료로 처리할 수 없습니다.");
        }
        this.appliedFee = appliedFee;
        this.paymentStatus = paymentStatus;
        this.paidAt = paymentStatus == AttendancePaymentStatus.PAID ? Instant.now() : null;
        this.feeOverridden = true;
        updatedAt = Instant.now();
    }

    public void applyDefaultParticipationFee(int defaultParticipationFee) {
        if (feeOverridden || participationType != AttendanceParticipationType.NORMAL) {
            return;
        }
        if (defaultParticipationFee < 0) {
            throw new IllegalArgumentException("Participation fee must not be negative.");
        }
        appliedFee = defaultParticipationFee;
        paymentStatus = defaultParticipationFee == 0
                ? AttendancePaymentStatus.EXEMPT
                : AttendancePaymentStatus.PENDING;
        paidAt = null;
        updatedAt = Instant.now();
    }

    /**
     * Leaders and staff start out exempt, but an administrator may explicitly override that
     * default for an exceptional gathering.
     */
    public void applyRoleFeeExemption() {
        if (feeOverridden || participationType != AttendanceParticipationType.NORMAL) {
            return;
        }
        appliedFee = 0;
        paymentStatus = AttendancePaymentStatus.EXEMPT;
        paidAt = null;
        updatedAt = Instant.now();
    }

    public void cancel(String cancellationReason) {
        if (attendanceStatus == AttendanceStatus.CANCELLED) {
            throw new IllegalArgumentException("이미 취소된 출석입니다.");
        }
        if (cancellationReason == null || cancellationReason.isBlank()) {
            throw new IllegalArgumentException("출석 취소 사유는 필수입니다.");
        }
        attendanceStatus = AttendanceStatus.CANCELLED;
        this.cancellationReason = cancellationReason;
        cancelledAt = Instant.now();
        updatedAt = cancelledAt;
    }

    /**
     * A re-attendance keeps the original record and cancellation audit instead of creating a duplicate.
     */
    public void recordAgain(AttendanceParticipationType newParticipationType) {
        if (attendanceStatus != AttendanceStatus.CANCELLED) {
            throw new IllegalArgumentException("Only a cancelled attendance can be recorded again.");
        }
        participationType = newParticipationType;
        attendanceStatus = AttendanceStatus.RECORDED;
        recordedAt = Instant.now();
        cancelledAt = null;
        cancellationReason = null;
        updatedAt = recordedAt;
    }

    public void changeParticipationType(AttendanceParticipationType newParticipationType) {
        participationType = newParticipationType;
        updatedAt = Instant.now();
    }
}
