package com.moingmoing.statistics.application;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberActivityExclusion;

public class MonthlyStatisticsPolicy {
    public MonthlyStatisticsResult calculate(
            YearMonth month,
            List<Member> members,
            List<MemberActivityExclusion> exclusions,
            List<Gathering> gatherings,
            List<Attendance> attendances) {
        LocalDate monthStart = month.atDay(1);
        LocalDate monthEnd = month.atEndOfMonth();
        List<Member> targetMembers = members.stream()
                // A member counts in the denominator when their membership overlapped even one day of the month.
                .filter(member -> overlaps(member.getJoinedOn(), member.getWithdrawnOn(), monthStart, monthEnd))
                .toList();
        Set<UUID> targetMemberIds = targetMembers.stream().map(Member::getId).collect(Collectors.toSet());
        Map<UUID, Gathering> gatheringsById = gatherings.stream()
                .collect(Collectors.toMap(Gathering::getId, Function.identity()));
        Set<UUID> attendedMemberIds = attendances.stream()
                .filter(attendance -> attendance.getAttendanceStatus() == AttendanceStatus.RECORDED)
                .filter(attendance -> targetMemberIds.contains(attendance.getMemberId()))
                .filter(attendance -> isCountedGathering(gatheringsById.get(attendance.getGatheringId()), month))
                .map(Attendance::getMemberId)
                .collect(Collectors.toSet());
        // Activity rate is a union: a member who attended and was temporarily excluded still counts only once.
        Set<UUID> activityExcludedMemberIds = exclusions.stream()
                .filter(exclusion -> targetMemberIds.contains(exclusion.getMemberId()))
                .filter(exclusion -> overlaps(exclusion.getStartDate(), exclusion.getEndDate(), monthStart, monthEnd))
                .map(MemberActivityExclusion::getMemberId)
                .collect(Collectors.toSet());

        return new MonthlyStatisticsResult(month, targetMembers, attendedMemberIds, activityExcludedMemberIds);
    }

    private boolean isCountedGathering(Gathering gathering, YearMonth month) {
        return gathering != null
                && gathering.getGatheringStatus() != GatheringStatus.CANCELLED
                && YearMonth.from(gathering.getHeldOn()).equals(month);
    }

    private boolean overlaps(LocalDate start, LocalDate end, LocalDate monthStart, LocalDate monthEnd) {
        return !start.isAfter(monthEnd) && (end == null || !end.isBefore(monthStart));
    }
}
