package com.moingmoing.statistics.api;

import java.time.DateTimeException;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Pattern;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.validation.annotation.Validated;

import com.moingmoing.member.domain.Member;
import com.moingmoing.statistics.application.MonthlyStatisticsResult;
import com.moingmoing.statistics.application.MonthlyStatisticsService;

@RestController
@Validated
@RequestMapping("/api/v1/statistics")
class MonthlyStatisticsController {
    private final MonthlyStatisticsService monthlyStatisticsService;

    MonthlyStatisticsController(MonthlyStatisticsService monthlyStatisticsService) {
        this.monthlyStatisticsService = monthlyStatisticsService;
    }

    @GetMapping("/monthly")
    MonthlyStatisticsResponse monthlyStatistics(
            @RequestParam @Pattern(regexp = "\\d{4}-\\d{2}") String month) {
        return MonthlyStatisticsResponse.from(monthlyStatisticsService.calculate(parseMonth(month)));
    }

    private YearMonth parseMonth(String month) {
        try {
            return YearMonth.parse(month);
        } catch (DateTimeException exception) {
            throw new IllegalArgumentException("month는 YYYY-MM 형식의 유효한 월이어야 합니다.");
        }
    }
}

record MonthlyStatisticsResponse(
        String policyVersion,
        String month,
        int attendanceNumerator,
        int activityNumerator,
        int denominator,
        double attendanceRate,
        double activityRate,
        List<StatisticsMemberResponse> targetMembers,
        List<UUID> attendedMemberIds,
        List<UUID> activityExcludedMemberIds) {
    static MonthlyStatisticsResponse from(MonthlyStatisticsResult result) {
        return new MonthlyStatisticsResponse(
                "draft-v1",
                result.month().toString(),
                result.attendanceNumerator(),
                result.activityNumerator(),
                result.denominator(),
                result.attendanceRate(),
                result.activityRate(),
                result.targetMembers().stream().map(StatisticsMemberResponse::from).toList(),
                result.attendedMemberIds().stream().sorted().toList(),
                result.activityExcludedMemberIds().stream().sorted().toList());
    }
}

record StatisticsMemberResponse(UUID id, String displayName) {
    static StatisticsMemberResponse from(Member member) {
        return new StatisticsMemberResponse(member.getId(), member.getDisplayName());
    }
}
