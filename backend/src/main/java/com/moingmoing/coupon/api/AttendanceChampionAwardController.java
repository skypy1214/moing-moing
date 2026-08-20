package com.moingmoing.coupon.api;

import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.coupon.application.AttendanceChampionAwardService;
import com.moingmoing.coupon.domain.AttendanceChampionAward;
import com.moingmoing.coupon.domain.AttendanceChampionAwardStatus;

@RestController
@RequestMapping("/api/v1/attendance-champion-awards")
class AttendanceChampionAwardController {
    private final AttendanceChampionAwardService awardService;

    AttendanceChampionAwardController(AttendanceChampionAwardService awardService) {
        this.awardService = awardService;
    }

    @PostMapping
    List<AttendanceChampionAwardResponse> grant(@Valid @RequestBody GrantAttendanceChampionAwardRequest request) {
        return awardService.grant(request.month()).stream().map(AttendanceChampionAwardResponse::from).toList();
    }

    @PostMapping("/{id}/cancel")
    AttendanceChampionAwardResponse cancel(@PathVariable UUID id) {
        return AttendanceChampionAwardResponse.from(awardService.cancel(id));
    }
}

record GrantAttendanceChampionAwardRequest(@NotNull YearMonth month) {
}

record AttendanceChampionAwardResponse(
        UUID id,
        YearMonth month,
        UUID memberId,
        int qualifyingAttendanceCount,
        int rank,
        String policyVersion,
        int rewardUses,
        AttendanceChampionAwardStatus awardStatus) {
    static AttendanceChampionAwardResponse from(AttendanceChampionAward award) {
        return new AttendanceChampionAwardResponse(
                award.getId(), YearMonth.from(award.getTargetMonth()), award.getMemberId(),
                award.getQualifyingAttendanceCount(), award.getRank(), award.getPolicyVersion(),
                award.getRewardUses(), award.getAwardStatus());
    }
}
