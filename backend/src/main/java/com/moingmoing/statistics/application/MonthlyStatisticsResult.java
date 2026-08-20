package com.moingmoing.statistics.application;

import java.time.YearMonth;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.moingmoing.member.domain.Member;

public record MonthlyStatisticsResult(
        YearMonth month,
        List<Member> targetMembers,
        Set<UUID> attendedMemberIds,
        Set<UUID> activityExcludedMemberIds) {
    public int attendanceNumerator() {
        return attendedMemberIds.size();
    }

    public int activityNumerator() {
        // Count the union rather than adding both sets, so an attendee on a personal break is never double-counted.
        return (int) targetMembers.stream()
                .map(Member::getId)
                .filter(memberId -> attendedMemberIds.contains(memberId)
                        || activityExcludedMemberIds.contains(memberId))
                .count();
    }

    public int denominator() {
        return targetMembers.size();
    }

    public double attendanceRate() {
        return rate(attendanceNumerator());
    }

    public double activityRate() {
        return rate(activityNumerator());
    }

    private double rate(int numerator) {
        if (denominator() == 0) {
            return 0;
        }
        return (double) numerator / denominator();
    }
}
