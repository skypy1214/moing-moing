package com.moingmoing.coupon.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.coupon.infrastructure.AttendanceChampionAwardRepository;
import com.moingmoing.coupon.infrastructure.ChampionRewardPolicyRepository;
import com.moingmoing.coupon.infrastructure.ChampionRewardPolicyTierRepository;
import com.moingmoing.coupon.infrastructure.CouponRepository;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberRole;
import com.moingmoing.member.infrastructure.MemberRepository;

@ExtendWith(MockitoExtension.class)
class AttendanceChampionAwardServiceTest {
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private GatheringRepository gatheringRepository;
    @Mock
    private AttendanceChampionAwardRepository awardRepository;
    @Mock
    private ChampionRewardPolicyRepository policyRepository;
    @Mock
    private ChampionRewardPolicyTierRepository tierRepository;
    @Mock
    private CouponRepository couponRepository;
    @Mock
    private MemberRepository memberRepository;
    @InjectMocks
    private AttendanceChampionAwardService service;

    @Test
    void excludesStaffAndLeaderFromAttendanceChampionCandidates() {
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 21), null, null, null);
        gathering.open();
        Member staff = new Member("운영진", null, LocalDate.of(2025, 1, 1), null, MemberRole.STAFF);
        Member leader = new Member("모임장", null, LocalDate.of(2025, 1, 1), null, MemberRole.LEADER);

        when(awardRepository.findByTargetMonthOrderByMemberIdAsc(LocalDate.of(2026, 8, 1)))
                .thenReturn(List.of());
        when(gatheringRepository.findAll()).thenReturn(List.of(gathering));
        when(memberRepository.findAll()).thenReturn(List.of(staff, leader));
        when(attendanceRepository.findAll()).thenReturn(List.of(
                new Attendance(gathering.getId(), staff.getId(), AttendanceParticipationType.NORMAL),
                new Attendance(gathering.getId(), leader.getId(), AttendanceParticipationType.NORMAL)));

        assertThat(service.grant(YearMonth.of(2026, 8))).isEmpty();
    }
}
