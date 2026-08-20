package com.moingmoing.coupon.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.coupon.domain.Coupon;

public interface CouponRepository extends JpaRepository<Coupon, UUID> {
    List<Coupon> findAllByOrderByIssuedAtDesc();

    List<Coupon> findByMemberIdOrderByIssuedAtDesc(UUID memberId);

    List<Coupon> findByChampionAwardIdOrderByIssuedAtDesc(UUID championAwardId);

    Optional<Coupon> findByQrTokenHash(String qrTokenHash);
}
