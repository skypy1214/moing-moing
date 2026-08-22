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
    private Instant createdAt;
    private Instant updatedAt;

    protected Attendance() {
    }

    public Attendance(UUID gatheringId, UUID memberId, AttendanceParticipationType participationType) {
        this.id = UUID.randomUUID();
        this.gatheringId = gatheringId;
        this.memberId = memberId;
        this.participationType = participationType;
        this.attendanceStatus = AttendanceStatus.RECORDED;
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
