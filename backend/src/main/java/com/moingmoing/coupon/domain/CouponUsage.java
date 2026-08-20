package com.moingmoing.coupon.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "coupon_usages")
public class CouponUsage {
    @Id
    private UUID id;
    private UUID couponId;
    private UUID attendanceId;
    @Enumerated(EnumType.STRING)
    private CouponUsageStatus usageStatus;
    private Instant usedAt;
    private Instant reversedAt;
    private String reversalReason;
    private Instant createdAt;
    private Instant updatedAt;

    protected CouponUsage() {
    }

    public CouponUsage(UUID couponId, UUID attendanceId) {
        id = UUID.randomUUID();
        this.couponId = couponId;
        this.attendanceId = attendanceId;
        usageStatus = CouponUsageStatus.USED;
        usedAt = Instant.now();
        createdAt = usedAt;
        updatedAt = usedAt;
    }

    public UUID getId() { return id; }
    public UUID getCouponId() { return couponId; }
    public UUID getAttendanceId() { return attendanceId; }
    public CouponUsageStatus getUsageStatus() { return usageStatus; }

    public void reverse(String reason) {
        if (usageStatus != CouponUsageStatus.USED || reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Only a used coupon can be reversed with a reason.");
        }
        usageStatus = CouponUsageStatus.REVERSED;
        reversalReason = reason;
        reversedAt = Instant.now();
        updatedAt = reversedAt;
    }
}
