package com.moingmoing.coupon.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "coupons")
public class Coupon {
    @Id
    private UUID id;
    private UUID memberId;
    @Enumerated(EnumType.STRING)
    private CouponType couponType;
    @Enumerated(EnumType.STRING)
    private CouponStatus couponStatus;
    private LocalDate validFrom;
    private LocalDate validUntil;
    private int totalUses;
    private int remainingUses;
    private String issuedReason;
    private UUID championAwardId;
    private String qrTokenHash;
    private Instant issuedAt;
    private Instant suspendedAt;
    private Instant voidedAt;
    private Instant createdAt;
    private Instant updatedAt;

    protected Coupon() {
    }

    public Coupon(
            UUID memberId,
            CouponType couponType,
            LocalDate validFrom,
            LocalDate validUntil,
            int totalUses,
            String issuedReason) {
        if (validUntil.isBefore(validFrom)) {
            throw new IllegalArgumentException("Coupon expiry cannot be before its start date.");
        }
        if (totalUses < 1) {
            throw new IllegalArgumentException("Coupon uses must be at least one.");
        }
        this.id = UUID.randomUUID();
        this.memberId = memberId;
        this.couponType = couponType;
        this.couponStatus = CouponStatus.ISSUED;
        this.validFrom = validFrom;
        this.validUntil = validUntil;
        this.totalUses = totalUses;
        this.remainingUses = totalUses;
        this.issuedReason = issuedReason;
        this.issuedAt = Instant.now();
        this.createdAt = issuedAt;
        this.updatedAt = issuedAt;
    }

    /**
     * Keeps the generated coupon linked to the immutable award decision that created it.
     * This link lets an administrator revoke an unspent automatic reward without deleting history.
     */
    public static Coupon attendanceChampionReward(
            UUID memberId, LocalDate validFrom, LocalDate validUntil, int totalUses, UUID championAwardId) {
        Coupon coupon = new Coupon(
                memberId,
                CouponType.ATTENDANCE_CHAMPION,
                validFrom,
                validUntil,
                totalUses,
                "Monthly attendance champion reward");
        coupon.championAwardId = championAwardId;
        return coupon;
    }

    public UUID getId() { return id; }
    public UUID getMemberId() { return memberId; }
    public CouponType getCouponType() { return couponType; }
    public CouponStatus getCouponStatus() { return couponStatus; }
    public LocalDate getValidFrom() { return validFrom; }
    public LocalDate getValidUntil() { return validUntil; }
    public int getTotalUses() { return totalUses; }
    public int getRemainingUses() { return remainingUses; }
    public String getIssuedReason() { return issuedReason; }
    public UUID getChampionAwardId() { return championAwardId; }
    public Instant getIssuedAt() { return issuedAt; }

    /** Stores only a SHA-256 digest so a database leak cannot reveal a usable QR token. */
    public void replaceQrToken(String rawToken) {
        qrTokenHash = sha256(rawToken);
        updatedAt = Instant.now();
    }

    public boolean matchesQrToken(String rawToken) {
        return qrTokenHash != null && MessageDigest.isEqual(
                qrTokenHash.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                sha256(rawToken).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public static String hashQrToken(String rawToken) {
        return sha256(rawToken);
    }

    public void useOn(LocalDate usedOn) {
        requireIssued("Only an issued coupon can be used.");
        if (usedOn.isBefore(validFrom) || usedOn.isAfter(validUntil)) {
            throw new IllegalArgumentException("Coupon is not valid on the gathering date.");
        }
        if (remainingUses == 0) {
            throw new IllegalArgumentException("Coupon has no remaining uses.");
        }
        remainingUses--;
        if (remainingUses == 0) {
            couponStatus = CouponStatus.FULLY_USED;
        }
        updatedAt = Instant.now();
    }

    public void restoreOneUse() {
        if (couponStatus == CouponStatus.VOIDED || remainingUses >= totalUses) {
            throw new IllegalArgumentException("Coupon use cannot be restored.");
        }
        remainingUses++;
        // A reversal must make a previously fully used coupon available again.
        if (couponStatus == CouponStatus.FULLY_USED) {
            couponStatus = CouponStatus.ISSUED;
        }
        updatedAt = Instant.now();
    }

    public void suspend() {
        requireIssued("Only an issued coupon can be suspended.");
        couponStatus = CouponStatus.SUSPENDED;
        suspendedAt = Instant.now();
        updatedAt = suspendedAt;
    }

    public void voidCoupon() {
        if (couponStatus == CouponStatus.VOIDED || couponStatus == CouponStatus.FULLY_USED) {
            throw new IllegalArgumentException("This coupon cannot be voided.");
        }
        // Void is irreversible because the original issue must remain auditable after an operator mistake.
        couponStatus = CouponStatus.VOIDED;
        voidedAt = Instant.now();
        updatedAt = voidedAt;
    }

    public void extendUntil(LocalDate newValidUntil) {
        if (couponStatus == CouponStatus.VOIDED || couponStatus == CouponStatus.FULLY_USED) {
            throw new IllegalArgumentException("This coupon cannot have its expiry extended.");
        }
        if (newValidUntil.isBefore(validFrom) || !newValidUntil.isAfter(validUntil)) {
            throw new IllegalArgumentException("Coupon expiry must be extended to a later valid date.");
        }
        validUntil = newValidUntil;
        updatedAt = Instant.now();
    }

    private void requireIssued(String message) {
        if (couponStatus != CouponStatus.ISSUED) {
            throw new IllegalArgumentException(message);
        }
    }

    private static String sha256(String value) {
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available in the Java runtime.", exception);
        }
    }
}
