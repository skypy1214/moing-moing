package com.moingmoing.coupon.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.coupon.domain.CouponUsage;

public interface CouponUsageRepository extends JpaRepository<CouponUsage, UUID> {
    List<CouponUsage> findByCouponIdOrderByUsedAtDesc(UUID couponId);

    Optional<CouponUsage> findByAttendanceId(UUID attendanceId);
}
