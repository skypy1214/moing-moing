package com.moingmoing.coupon.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.security.SecureRandom;
import java.util.Base64;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.coupon.domain.Coupon;
import com.moingmoing.coupon.domain.CouponType;
import com.moingmoing.coupon.domain.CouponUsage;
import com.moingmoing.coupon.infrastructure.CouponRepository;
import com.moingmoing.coupon.infrastructure.CouponUsageRepository;
import com.moingmoing.attendance.application.AttendanceService;
import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.application.MemberService;

@Service
@Transactional
public class CouponService {
    private static final SecureRandom QR_TOKEN_RANDOM = new SecureRandom();
    private final CouponRepository couponRepository;
    private final CouponUsageRepository couponUsageRepository;
    private final MemberService memberService;
    private final AttendanceService attendanceService;
    private final AttendanceRepository attendanceRepository;
    private final GatheringRepository gatheringRepository;

    public CouponService(
            CouponRepository couponRepository,
            CouponUsageRepository couponUsageRepository,
            MemberService memberService,
            AttendanceService attendanceService,
            AttendanceRepository attendanceRepository,
            GatheringRepository gatheringRepository) {
        this.couponRepository = couponRepository;
        this.couponUsageRepository = couponUsageRepository;
        this.memberService = memberService;
        this.attendanceService = attendanceService;
        this.attendanceRepository = attendanceRepository;
        this.gatheringRepository = gatheringRepository;
    }

    public Coupon issueManualCoupon(
            UUID memberId, LocalDate validFrom, LocalDate validUntil, int totalUses, String issuedReason) {
        memberService.findById(memberId);
        return couponRepository.save(new Coupon(
                memberId, CouponType.MANUAL_FREE_PASS, validFrom, validUntil, totalUses, issuedReason));
    }

    @Transactional(readOnly = true)
    public List<Coupon> findCoupons(UUID memberId) {
        if (memberId == null) {
            return couponRepository.findAllByOrderByIssuedAtDesc();
        }
        memberService.findById(memberId);
        return couponRepository.findByMemberIdOrderByIssuedAtDesc(memberId);
    }

    public Coupon suspend(UUID couponId) {
        Coupon coupon = findById(couponId);
        coupon.suspend();
        return coupon;
    }

    public Coupon voidCoupon(UUID couponId) {
        Coupon coupon = findById(couponId);
        if (coupon.getChampionAwardId() != null) {
            // The award and its coupon must change together to preserve the audit trail.
            throw new IllegalArgumentException("Cancel the attendance champion award instead of this coupon.");
        }
        coupon.voidCoupon();
        return coupon;
    }

    public Coupon extendUntil(UUID couponId, LocalDate validUntil) {
        Coupon coupon = findById(couponId);
        coupon.extendUntil(validUntil);
        return coupon;
    }

    /** The raw token is returned once for QR encoding; only its digest is retained. */
    public String issueQrToken(UUID couponId) {
        Coupon coupon = findById(couponId);
        byte[] bytes = new byte[32];
        QR_TOKEN_RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        coupon.replaceQrToken(token);
        return token;
    }

    public CouponUsage useForAttendance(UUID couponId, UUID gatheringId) {
        Coupon coupon = findById(couponId);
        LocalDate heldOn = gatheringRepository.findById(gatheringId)
                .orElseThrow(() -> new IllegalArgumentException("Gathering not found."))
                .getHeldOn();
        coupon.useOn(heldOn);
        Attendance attendance = attendanceService.recordAttendance(
                gatheringId, coupon.getMemberId(), AttendanceParticipationType.COUPON);
        return couponUsageRepository.save(new CouponUsage(couponId, attendance.getId()));
    }

    public CouponUsage useQrTokenForAttendance(String token, UUID gatheringId) {
        Coupon coupon = couponRepository.findByQrTokenHash(Coupon.hashQrToken(token))
                .orElseThrow(() -> new IllegalArgumentException("QR coupon token is invalid."));
        return useForAttendance(coupon.getId(), gatheringId);
    }

    public CouponUsage reverseUsage(UUID couponId, UUID usageId, String reason) {
        CouponUsage usage = couponUsageRepository.findById(usageId)
                .filter(found -> found.getCouponId().equals(couponId))
                .orElseThrow(() -> new IllegalArgumentException("Coupon usage not found."));
        Coupon coupon = findById(couponId);
        Attendance attendance = attendanceRepository.findById(usage.getAttendanceId())
                .orElseThrow(() -> new IllegalArgumentException("Attendance not found."));
        attendance.cancel(reason);
        coupon.restoreOneUse();
        usage.reverse(reason);
        return usage;
    }

    @Transactional(readOnly = true)
    public List<CouponUsage> findUsages(UUID couponId) {
        findById(couponId);
        return couponUsageRepository.findByCouponIdOrderByUsedAtDesc(couponId);
    }

    private Coupon findById(UUID couponId) {
        return couponRepository.findById(couponId)
                .orElseThrow(() -> new CouponNotFoundException(couponId));
    }
}
