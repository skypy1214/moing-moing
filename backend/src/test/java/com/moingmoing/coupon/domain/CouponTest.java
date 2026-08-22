package com.moingmoing.coupon.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.LocalDate;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class CouponTest {
    @Test
    void issues_a_manual_coupon_with_all_uses_remaining() {
        Coupon coupon = new Coupon(
                UUID.randomUUID(),
                CouponType.MANUAL_FREE_PASS,
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 30),
                2,
                "테스트 쿠폰",
                "Manual reward");

        assertEquals(CouponStatus.ISSUED, coupon.getCouponStatus());
        assertEquals(2, coupon.getTotalUses());
        assertEquals(2, coupon.getRemainingUses());
    }

    @Test
    void rejects_an_expiry_before_the_start_date() {
        assertThrows(IllegalArgumentException.class, () -> new Coupon(
                UUID.randomUUID(),
                CouponType.MANUAL_FREE_PASS,
                LocalDate.of(2026, 9, 2),
                LocalDate.of(2026, 9, 1),
                1,
                "테스트 쿠폰",
                null));
    }

    @Test
    void preserves_the_coupon_as_voided_instead_of_deleting_it() {
        Coupon coupon = new Coupon(
                UUID.randomUUID(), CouponType.MANUAL_FREE_PASS,
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), 1, "테스트 쿠폰", null);

        coupon.voidCoupon();

        assertEquals(CouponStatus.VOIDED, coupon.getCouponStatus());
        assertThrows(IllegalArgumentException.class, () -> coupon.extendUntil(LocalDate.of(2026, 10, 1)));
    }

    @Test
    void restores_an_unused_voided_coupon() {
        Coupon coupon = new Coupon(
                UUID.randomUUID(), CouponType.MANUAL_FREE_PASS,
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), 1, "테스트 쿠폰", null);

        coupon.voidCoupon();
        coupon.restoreVoidedCoupon();

        assertEquals(CouponStatus.ISSUED, coupon.getCouponStatus());
    }

    @Test
    void restores_a_use_after_a_coupon_attendance_is_reversed() {
        Coupon coupon = new Coupon(
                UUID.randomUUID(), CouponType.MANUAL_FREE_PASS,
                LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30), 1, "테스트 쿠폰", null);

        coupon.useOn(LocalDate.of(2026, 9, 10));
        coupon.restoreOneUse();

        assertEquals(CouponStatus.ISSUED, coupon.getCouponStatus());
        assertEquals(1, coupon.getRemainingUses());
    }

    @Test
    void links_an_automatic_champion_coupon_to_its_award() {
        UUID awardId = UUID.randomUUID();
        Coupon coupon = Coupon.attendanceChampionReward(
                UUID.randomUUID(), LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), 2, awardId);

        assertEquals(CouponType.ATTENDANCE_CHAMPION, coupon.getCouponType());
        assertEquals(awardId, coupon.getChampionAwardId());
    }
}
