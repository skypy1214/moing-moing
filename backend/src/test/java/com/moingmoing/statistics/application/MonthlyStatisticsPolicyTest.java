package com.moingmoing.statistics.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.member.domain.ActivityExclusionReason;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberActivityExclusion;

class MonthlyStatisticsPolicyTest {
    private final MonthlyStatisticsPolicy policy = new MonthlyStatisticsPolicy();

    @Test
    void calculatesRatesUsingMembersWhoseMembershipOverlapsTheMonth() {
        Member attendedMember = new Member("출석 회원", null, LocalDate.of(2026, 8, 1), null);
        Member excludedMember = new Member("활동 중단 회원", null, LocalDate.of(2026, 8, 10), null);
        Member futureMember = new Member("미래 회원", null, LocalDate.of(2026, 9, 1), null);
        Member withdrawnMember = new Member("탈퇴 회원", null, LocalDate.of(2026, 1, 1), null);
        withdrawnMember.withdraw(LocalDate.of(2026, 7, 31));
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);
        Attendance attendance = new Attendance(
                gathering.getId(), attendedMember.getId(), AttendanceParticipationType.NORMAL);
        MemberActivityExclusion exclusion = new MemberActivityExclusion(
                excludedMember.getId(), ActivityExclusionReason.PERSONAL_BREAK,
                LocalDate.of(2026, 8, 15), null);

        MonthlyStatisticsResult result = policy.calculate(
                YearMonth.of(2026, 8),
                List.of(attendedMember, excludedMember, futureMember, withdrawnMember),
                List.of(exclusion),
                List.of(gathering),
                List.of(attendance));

        assertThat(result.denominator()).isEqualTo(2);
        assertThat(result.attendanceNumerator()).isEqualTo(1);
        assertThat(result.activityNumerator()).isEqualTo(2);
        assertThat(result.attendanceRate()).isEqualTo(0.5);
        assertThat(result.activityRate()).isEqualTo(1.0);
    }

    @Test
    void excludesCancelledAttendanceAndCancelledGatheringsFromAttendanceRate() {
        Member member = new Member("회원", null, LocalDate.of(2026, 1, 1), null);
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);
        Attendance attendance = new Attendance(
                gathering.getId(), member.getId(), AttendanceParticipationType.COUPON);
        attendance.cancel("입력 실수");

        MonthlyStatisticsResult result = policy.calculate(
                YearMonth.of(2026, 8), List.of(member), List.of(), List.of(gathering), List.of(attendance));

        assertThat(result.attendanceNumerator()).isZero();
        assertThat(result.activityNumerator()).isZero();
    }
}
