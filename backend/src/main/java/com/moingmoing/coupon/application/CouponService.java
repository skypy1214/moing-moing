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
    private final CouponQrTokenCipher qrTokenCipher;

    public CouponService(
            CouponRepository couponRepository,
            CouponUsageRepository couponUsageRepository,
            MemberService memberService,
            AttendanceService attendanceService,
            AttendanceRepository attendanceRepository,
            GatheringRepository gatheringRepository,
            CouponQrTokenCipher qrTokenCipher) {
        this.couponRepository = couponRepository;
        this.couponUsageRepository = couponUsageRepository;
        this.memberService = memberService;
        this.attendanceService = attendanceService;
        this.attendanceRepository = attendanceRepository;
        this.gatheringRepository = gatheringRepository;
        this.qrTokenCipher = qrTokenCipher;
    }

    public Coupon issueManualCoupon(
            UUID memberId,
            LocalDate validFrom,
            LocalDate validUntil,
            int totalUses,
            String name,
            String issuedReason) {
        memberService.findById(memberId);
        return couponRepository.save(new Coupon(
                memberId, CouponType.MANUAL_FREE_PASS, validFrom, validUntil, totalUses, name, issuedReason));
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

    public Coupon restoreVoidedCoupon(UUID couponId) {
        Coupon coupon = findById(couponId);
        if (coupon.getChampionAwardId() != null) {
            throw new IllegalArgumentException("Attendance champion coupons cannot be restored individually.");
        }
        coupon.restoreVoidedCoupon();
        return coupon;
    }

    public Coupon extendUntil(UUID couponId, LocalDate validUntil) {
        Coupon coupon = findById(couponId);
        coupon.extendUntil(validUntil);
        return coupon;
    }

    /** Issuing a token deliberately replaces the previous one, invalidating its QR code. */
    public String issueQrToken(UUID couponId) {
        Coupon coupon = findById(couponId);
        byte[] bytes = new byte[32];
        QR_TOKEN_RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        coupon.replaceQrToken(token, qrTokenCipher.encrypt(token));
        return token;
    }

    @Transactional(readOnly = true)
    public String viewQrToken(UUID couponId) {
        Coupon coupon = findById(couponId);
        if (!coupon.hasViewableQrToken()) {
            throw new IllegalArgumentException("This QR code must be issued again before it can be viewed.");
        }
        return qrTokenCipher.decrypt(coupon.getQrTokenCiphertext());
    }

    /** Looks up a scanned token without consuming the coupon; use remains an explicit follow-up action. */
    @Transactional(readOnly = true)
    public Coupon findByQrToken(String token) {
        return couponRepository.findByQrTokenHash(Coupon.hashQrToken(token))
                .orElseThrow(() -> new IllegalArgumentException("QR coupon token is invalid."));
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
        Coupon coupon = findByQrToken(token);
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

    public CouponUsage reverseUsageForAttendance(UUID attendanceId, String reason) {
        CouponUsage usage = couponUsageRepository.findByAttendanceId(attendanceId)
                .orElseThrow(() -> new IllegalArgumentException("Coupon usage not found."));
        return reverseUsage(usage.getCouponId(), usage.getId(), reason);
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
