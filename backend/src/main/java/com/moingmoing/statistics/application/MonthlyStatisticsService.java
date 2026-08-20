package com.moingmoing.statistics.application;

import java.time.YearMonth;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.infrastructure.MemberActivityExclusionRepository;
import com.moingmoing.member.infrastructure.MemberRepository;

@Service
@Transactional(readOnly = true)
public class MonthlyStatisticsService {
    private final MemberRepository memberRepository;
    private final MemberActivityExclusionRepository activityExclusionRepository;
    private final GatheringRepository gatheringRepository;
    private final AttendanceRepository attendanceRepository;
    private final MonthlyStatisticsPolicy policy = new MonthlyStatisticsPolicy();

    public MonthlyStatisticsService(
            MemberRepository memberRepository,
            MemberActivityExclusionRepository activityExclusionRepository,
            GatheringRepository gatheringRepository,
            AttendanceRepository attendanceRepository) {
        this.memberRepository = memberRepository;
        this.activityExclusionRepository = activityExclusionRepository;
        this.gatheringRepository = gatheringRepository;
        this.attendanceRepository = attendanceRepository;
    }

    public MonthlyStatisticsResult calculate(YearMonth month) {
        return policy.calculate(
                month,
                memberRepository.findAll(),
                activityExclusionRepository.findAll(),
                gatheringRepository.findAll(),
                attendanceRepository.findAll());
    }
}
