package com.moingmoing.coupon.api;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.coupon.application.CouponService;
import com.moingmoing.coupon.domain.Coupon;
import com.moingmoing.coupon.domain.CouponStatus;
import com.moingmoing.coupon.domain.CouponType;
import com.moingmoing.coupon.domain.CouponUsage;
import com.moingmoing.coupon.domain.CouponUsageStatus;

@RestController
@RequestMapping("/api/v1/coupons")
class CouponController {
    private final CouponService couponService;

    CouponController(CouponService couponService) {
        this.couponService = couponService;
    }

    @GetMapping
    List<CouponResponse> list(@RequestParam(required = false) UUID memberId) {
        return couponService.findCoupons(memberId).stream().map(CouponResponse::from).toList();
    }

    @PostMapping
    ResponseEntity<CouponResponse> issue(@Valid @RequestBody IssueManualCouponRequest request) {
        CouponResponse response = CouponResponse.from(couponService.issueManualCoupon(
                request.memberId(),
                request.validFrom(),
                request.validUntil(),
                request.totalUses(),
                request.issuedReason()));
        return ResponseEntity.created(URI.create("/api/v1/coupons/" + response.id())).body(response);
    }

    @PostMapping("/{id}/suspend")
    CouponResponse suspend(@PathVariable UUID id) {
        return CouponResponse.from(couponService.suspend(id));
    }

    @PostMapping("/{id}/void")
    CouponResponse voidCoupon(@PathVariable UUID id) {
        return CouponResponse.from(couponService.voidCoupon(id));
    }

    @PutMapping("/{id}/valid-until")
    CouponResponse extendUntil(@PathVariable UUID id, @Valid @RequestBody ExtendCouponRequest request) {
        return CouponResponse.from(couponService.extendUntil(id, request.validUntil()));
    }

    @GetMapping("/{id}/usages")
    List<CouponUsageResponse> usages(@PathVariable UUID id) {
        return couponService.findUsages(id).stream().map(CouponUsageResponse::from).toList();
    }

    @PostMapping("/{id}/use")
    CouponUsageResponse use(@PathVariable UUID id, @Valid @RequestBody UseCouponRequest request) {
        return CouponUsageResponse.from(couponService.useForAttendance(id, request.gatheringId()));
    }

    @PostMapping("/{id}/qr-token")
    QrTokenResponse issueQrToken(@PathVariable UUID id) {
        return new QrTokenResponse(couponService.issueQrToken(id));
    }

    @PostMapping("/qr/validate")
    CouponResponse validateQrToken(@Valid @RequestBody ValidateQrCouponRequest request) {
        return CouponResponse.from(couponService.findByQrToken(request.token()));
    }

    @PostMapping("/qr/use")
    CouponUsageResponse useQrToken(@Valid @RequestBody UseQrCouponRequest request) {
        return CouponUsageResponse.from(couponService.useQrTokenForAttendance(request.token(), request.gatheringId()));
    }

    @PostMapping("/{id}/usages/{usageId}/reverse")
    CouponUsageResponse reverse(
            @PathVariable UUID id,
            @PathVariable UUID usageId,
            @Valid @RequestBody ReverseCouponUsageRequest request) {
        return CouponUsageResponse.from(couponService.reverseUsage(id, usageId, request.reason()));
    }
}

record IssueManualCouponRequest(
        @NotNull UUID memberId,
        @NotNull LocalDate validFrom,
        @NotNull LocalDate validUntil,
        @Min(1) int totalUses,
        @Size(max = 1000) String issuedReason) {
}

record ExtendCouponRequest(@NotNull LocalDate validUntil) {
}

record UseCouponRequest(@NotNull UUID gatheringId) {
}

record ReverseCouponUsageRequest(@NotBlank @Size(max = 1000) String reason) {
}

record CouponResponse(
        UUID id,
        UUID memberId,
        CouponType couponType,
        CouponStatus couponStatus,
        LocalDate validFrom,
        LocalDate validUntil,
        int totalUses,
        int remainingUses,
        String issuedReason) {
    static CouponResponse from(Coupon coupon) {
        return new CouponResponse(
                coupon.getId(), coupon.getMemberId(), coupon.getCouponType(), coupon.getCouponStatus(),
                coupon.getValidFrom(), coupon.getValidUntil(), coupon.getTotalUses(), coupon.getRemainingUses(),
                coupon.getIssuedReason());
    }
}

record CouponUsageResponse(UUID id, UUID couponId, UUID attendanceId, CouponUsageStatus usageStatus) {
    static CouponUsageResponse from(CouponUsage usage) {
        return new CouponUsageResponse(
                usage.getId(), usage.getCouponId(), usage.getAttendanceId(), usage.getUsageStatus());
    }
}

record QrTokenResponse(String token) {
}

record UseQrCouponRequest(@NotBlank String token, @NotNull UUID gatheringId) {
}

record ValidateQrCouponRequest(@NotBlank String token) {
}
