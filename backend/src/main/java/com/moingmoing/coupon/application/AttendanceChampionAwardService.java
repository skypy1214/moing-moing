package com.moingmoing.coupon.application;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.coupon.domain.AttendanceChampionAward;
import com.moingmoing.coupon.domain.ChampionRewardPolicy;
import com.moingmoing.coupon.domain.ChampionRewardPolicyTier;
import com.moingmoing.coupon.domain.Coupon;
import com.moingmoing.coupon.domain.CouponStatus;
import com.moingmoing.coupon.infrastructure.AttendanceChampionAwardRepository;
import com.moingmoing.coupon.infrastructure.ChampionRewardPolicyRepository;
import com.moingmoing.coupon.infrastructure.ChampionRewardPolicyTierRepository;
import com.moingmoing.coupon.infrastructure.CouponRepository;
import com.moingmoing.member.domain.MemberRole;
import com.moingmoing.member.infrastructure.MemberRepository;

@Service
@Transactional
public class AttendanceChampionAwardService {
    private final AttendanceRepository attendanceRepository;
    private final GatheringRepository gatheringRepository;
    private final AttendanceChampionAwardRepository awardRepository;
    private final ChampionRewardPolicyRepository policyRepository;
    private final ChampionRewardPolicyTierRepository tierRepository;
    private final CouponRepository couponRepository;
    private final MemberRepository memberRepository;

    public AttendanceChampionAwardService(
            AttendanceRepository attendanceRepository,
            GatheringRepository gatheringRepository,
            AttendanceChampionAwardRepository awardRepository,
            ChampionRewardPolicyRepository policyRepository,
            ChampionRewardPolicyTierRepository tierRepository,
            CouponRepository couponRepository,
            MemberRepository memberRepository) {
        this.attendanceRepository = attendanceRepository;
        this.gatheringRepository = gatheringRepository;
        this.awardRepository = awardRepository;
        this.policyRepository = policyRepository;
        this.tierRepository = tierRepository;
        this.couponRepository = couponRepository;
        this.memberRepository = memberRepository;
    }

    /**
     * Grants a month's awards once. Existing results are returned as-is so a repeated
     * admin action cannot issue duplicate rewards after a timeout or page refresh.
     */
    public List<AttendanceChampionAward> grant(YearMonth month) {
        LocalDate targetMonth = month.atDay(1);
        List<AttendanceChampionAward> existing = awardRepository.findByTargetMonthOrderByMemberIdAsc(targetMonth);
        if (!existing.isEmpty()) {
            return existing;
        }

        Map<UUID, Gathering> gatherings = gatheringRepository.findAll().stream()
                .collect(Collectors.toMap(Gathering::getId, Function.identity()));
        Map<UUID, MemberRole> memberRoles = memberRepository.findAll().stream()
                .collect(Collectors.toMap(member -> member.getId(), member -> member.getMemberRole()));
        Map<UUID, Long> counts = attendanceRepository.findAll().stream()
                .filter(attendance -> qualifies(attendance, gatherings, memberRoles, month))
                .collect(Collectors.groupingBy(Attendance::getMemberId, Collectors.counting()));
        if (counts.isEmpty()) {
            return List.of();
        }

        long highestCount = counts.values().stream().mapToLong(Long::longValue).max().orElseThrow();
        List<Map.Entry<UUID, Long>> winners = counts.entrySet().stream()
                .filter(entry -> entry.getValue() == highestCount)
                .sorted(Map.Entry.comparingByKey())
                .toList();
        ChampionRewardPolicy policy = policyRepository
                .findFirstByActiveTrueAndEffectiveFromLessThanEqualOrderByEffectiveFromDesc(targetMonth)
                .orElseThrow(() -> new IllegalStateException("No active attendance champion reward policy exists."));
        int rewardUses = tierRepository.findByPolicyIdOrderByTieCountFromAsc(policy.getId()).stream()
                .filter(tier -> tier.appliesTo(winners.size()))
                .findFirst()
                .map(ChampionRewardPolicyTier::getCouponUses)
                .orElseThrow(() -> new IllegalStateException("No reward tier matches the number of winners."));

        LocalDate validFrom = month.plusMonths(1).atDay(1);
        LocalDate validUntil = month.plusMonths(1).atEndOfMonth();
        return winners.stream().map(winner -> {
            AttendanceChampionAward award = awardRepository.save(new AttendanceChampionAward(
                    targetMonth, winner.getKey(), Math.toIntExact(highestCount), policy.getVersion(), rewardUses));
            couponRepository.save(Coupon.attendanceChampionReward(
                    award.getMemberId(), validFrom, validUntil, award.getRewardUses(), award.getId()));
            return award;
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<AttendanceChampionAward> findByMonth(YearMonth month) {
        return awardRepository.findByTargetMonthOrderByMemberIdAsc(month.atDay(1));
    }

    /**
     * A reward cancellation is audit-preserving. Coupons with any use are deliberately
     * protected: reverse the usage first so attendance and coupon balances stay consistent.
     */
    public AttendanceChampionAward cancel(UUID awardId) {
        AttendanceChampionAward award = awardRepository.findById(awardId)
                .orElseThrow(() -> new IllegalArgumentException("Attendance champion award not found."));
        List<Coupon> coupons = couponRepository.findByChampionAwardIdOrderByIssuedAtDesc(awardId);
        if (coupons.isEmpty()) {
            throw new IllegalStateException("Attendance champion award has no linked coupon.");
        }
        if (coupons.stream().anyMatch(coupon -> coupon.getRemainingUses() != coupon.getTotalUses()
                || coupon.getCouponStatus() == CouponStatus.FULLY_USED
                || coupon.getCouponStatus() == CouponStatus.VOIDED)) {
            throw new IllegalStateException("Reverse coupon usage before cancelling this award.");
        }
        coupons.forEach(Coupon::voidCoupon);
        award.cancel();
        return award;
    }

    public AttendanceChampionAward restore(UUID awardId) {
        AttendanceChampionAward award = awardRepository.findById(awardId)
                .orElseThrow(() -> new IllegalArgumentException("Attendance champion award not found."));
        List<Coupon> coupons = couponRepository.findByChampionAwardIdOrderByIssuedAtDesc(awardId);
        if (coupons.isEmpty() || coupons.stream().anyMatch(coupon -> coupon.getCouponStatus() != CouponStatus.VOIDED
                || coupon.getRemainingUses() != coupon.getTotalUses())) {
            throw new IllegalStateException("Only unused cancelled attendance champion coupons can be restored.");
        }
        coupons.forEach(Coupon::restoreVoidedCoupon);
        award.restore();
        return award;
    }

    private boolean qualifies(
            Attendance attendance,
            Map<UUID, Gathering> gatherings,
            Map<UUID, MemberRole> memberRoles,
            YearMonth month) {
        Gathering gathering = gatherings.get(attendance.getGatheringId());
        return attendance.getAttendanceStatus() == AttendanceStatus.RECORDED
                && attendance.getParticipationType() == AttendanceParticipationType.NORMAL
                && memberRoles.get(attendance.getMemberId()) == MemberRole.MEMBER
                && gathering != null
                && gathering.getGatheringStatus() != GatheringStatus.CANCELLED
                && YearMonth.from(gathering.getHeldOn()).equals(month);
    }
}
