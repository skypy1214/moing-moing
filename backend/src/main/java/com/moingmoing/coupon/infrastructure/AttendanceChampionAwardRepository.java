package com.moingmoing.coupon.infrastructure;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.coupon.domain.AttendanceChampionAward;

public interface AttendanceChampionAwardRepository extends JpaRepository<AttendanceChampionAward, UUID> {
    List<AttendanceChampionAward> findByTargetMonthOrderByMemberIdAsc(LocalDate targetMonth);
}
