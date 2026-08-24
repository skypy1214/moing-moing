package com.moingmoing.member.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberActivityExclusion;
import com.moingmoing.member.domain.ActivityExclusionReason;
import com.moingmoing.member.infrastructure.MemberActivityExclusionRepository;
import com.moingmoing.member.infrastructure.MemberRepository;

@ExtendWith(MockitoExtension.class)
class MemberServiceTest {
    @Mock
    private MemberRepository memberRepository;
    @Mock
    private MemberActivityExclusionRepository exclusionRepository;
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private GatheringRepository gatheringRepository;

    @Test
    void returnsTheLatestValidAttendanceDateForEachMember() {
        Member attendedMember = new Member("출석 회원", null, LocalDate.of(2025, 1, 1), null);
        Member noAttendanceMember = new Member("미출석 회원", null, LocalDate.of(2025, 1, 1), null);
        Gathering olderGathering = openGathering(LocalDate.now().minusMonths(2));
        Gathering latestGathering = openGathering(LocalDate.now().minusMonths(1));
        Gathering cancelledGathering = openGathering(LocalDate.now().minusDays(5));
        cancelledGathering.cancel("모임 취소");
        Gathering futureGathering = openGathering(LocalDate.now().plusDays(1));
        Attendance cancelledAttendance = new Attendance(
                latestGathering.getId(), attendedMember.getId(), AttendanceParticipationType.NORMAL);
        cancelledAttendance.cancel("출석 취소");

        when(memberRepository.findAll()).thenReturn(List.of(attendedMember, noAttendanceMember));
        when(gatheringRepository.findAll()).thenReturn(List.of(
                olderGathering, latestGathering, cancelledGathering, futureGathering));
        when(attendanceRepository.findAll()).thenReturn(List.of(
                new Attendance(olderGathering.getId(), attendedMember.getId(), AttendanceParticipationType.NORMAL),
                new Attendance(latestGathering.getId(), attendedMember.getId(), AttendanceParticipationType.NORMAL),
                new Attendance(cancelledGathering.getId(), attendedMember.getId(), AttendanceParticipationType.NORMAL),
                new Attendance(futureGathering.getId(), attendedMember.getId(), AttendanceParticipationType.NORMAL),
                cancelledAttendance));

        List<MemberAttendanceSummary> summaries = service().findAllWithLastAttendance();

        assertThat(summaries)
                .extracting(summary -> summary.member().getId(), MemberAttendanceSummary::lastAttendanceOn)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(attendedMember.getId(), latestGathering.getHeldOn()),
                        org.assertj.core.groups.Tuple.tuple(noAttendanceMember.getId(), null));
    }

    @Test
    void savesTheSpecifiedEndDateWhenStartingAnActivityExclusion() {
        Member member = new Member("기간 회원", null, LocalDate.of(2025, 1, 1), null);
        LocalDate startDate = LocalDate.of(2026, 8, 1);
        LocalDate endDate = LocalDate.of(2026, 8, 31);

        when(memberRepository.findById(member.getId())).thenReturn(Optional.of(member));
        when(exclusionRepository.existsOverlapping(member.getId(), null, startDate, endDate)).thenReturn(false);
        when(exclusionRepository.save(org.mockito.ArgumentMatchers.any(MemberActivityExclusion.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        MemberActivityExclusion exclusion = service().startExclusion(
                member.getId(), ActivityExclusionReason.MEDICAL, startDate, endDate, "치료 일정");

        assertThat(exclusion.getEndDate()).isEqualTo(endDate);
    }

    private MemberService service() {
        return new MemberService(
                memberRepository, exclusionRepository, attendanceRepository, gatheringRepository);
    }

    private Gathering openGathering(LocalDate heldOn) {
        Gathering gathering = new Gathering(heldOn, null, null, null);
        gathering.open();
        return gathering;
    }
}
