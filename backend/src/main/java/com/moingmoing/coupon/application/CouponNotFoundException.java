package com.moingmoing.coupon.application;

import java.util.UUID;

public class CouponNotFoundException extends RuntimeException {
    public CouponNotFoundException(UUID couponId) {
        super("Coupon not found: " + couponId);
    }
}
