package com.moingmoing.coupon.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "attendance_champion_awards")
public class AttendanceChampionAward {
    @Id
    private UUID id;
    private LocalDate targetMonth;
    private UUID memberId;
    private int qualifyingAttendanceCount;
    private int rank;
    private String policyVersion;
    private int rewardUses;
    @Enumerated(EnumType.STRING)
    private AttendanceChampionAwardStatus awardStatus;
    private Instant calculatedAt;
    private Instant grantedAt;
    private Instant createdAt;
    private Instant updatedAt;

    protected AttendanceChampionAward() {
    }

    public AttendanceChampionAward(
            LocalDate targetMonth,
            UUID memberId,
            int qualifyingAttendanceCount,
            String policyVersion,
            int rewardUses) {
        this.id = UUID.randomUUID();
        this.targetMonth = targetMonth.withDayOfMonth(1);
        this.memberId = memberId;
        this.qualifyingAttendanceCount = qualifyingAttendanceCount;
        this.rank = 1;
        this.policyVersion = policyVersion;
        this.rewardUses = rewardUses;
        this.awardStatus = AttendanceChampionAwardStatus.GRANTED;
        this.calculatedAt = Instant.now();
        this.grantedAt = calculatedAt;
        this.createdAt = calculatedAt;
        this.updatedAt = calculatedAt;
    }

    public UUID getId() { return id; }
    public LocalDate getTargetMonth() { return targetMonth; }
    public UUID getMemberId() { return memberId; }
    public int getQualifyingAttendanceCount() { return qualifyingAttendanceCount; }
    public int getRank() { return rank; }
    public String getPolicyVersion() { return policyVersion; }
    public int getRewardUses() { return rewardUses; }
    public AttendanceChampionAwardStatus getAwardStatus() { return awardStatus; }

    public void cancel() {
        if (awardStatus != AttendanceChampionAwardStatus.GRANTED) {
            throw new IllegalArgumentException("Only a granted attendance champion award can be cancelled.");
        }
        awardStatus = AttendanceChampionAwardStatus.CANCELLED;
        updatedAt = Instant.now();
    }
}
