package com.moingmoing.attendance.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.application.MemberService;
import com.moingmoing.member.domain.Member;

@ExtendWith(MockitoExtension.class)
class AttendanceServiceTest {
    @Mock
    private GatheringRepository gatheringRepository;
    @Mock
    private AttendanceRepository attendanceRepository;
    @Mock
    private MemberService memberService;

    @Test
    void recordsAttendanceForAnActiveMemberAtAnOpenGathering() {
        Gathering gathering = openGathering();
        Member member = new Member("회원", null, LocalDate.of(2026, 1, 1), null);
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));
        when(memberService.findById(member.getId())).thenReturn(member);
        when(attendanceRepository.findByGatheringIdAndMemberId(gathering.getId(), member.getId()))
                .thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Attendance attendance = attendanceService.recordAttendance(
                gathering.getId(), member.getId(), AttendanceParticipationType.NORMAL);

        assertThat(attendance.getGatheringId()).isEqualTo(gathering.getId());
        assertThat(attendance.getMemberId()).isEqualTo(member.getId());
        assertThat(attendance.getParticipationType()).isEqualTo(AttendanceParticipationType.NORMAL);
    }

    @Test
    void changesParticipationTypeForExistingAttendance() {
        Gathering gathering = openGathering();
        Member member = new Member("회원", null, LocalDate.of(2026, 1, 1), null);
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));
        when(memberService.findById(member.getId())).thenReturn(member);
        Attendance existing = new Attendance(
                gathering.getId(), member.getId(), AttendanceParticipationType.NORMAL);
        when(attendanceRepository.findByGatheringIdAndMemberId(gathering.getId(), member.getId()))
                .thenReturn(Optional.of(existing));

        Attendance changed = attendanceService.recordAttendance(
                gathering.getId(), member.getId(), AttendanceParticipationType.HOST);

        assertThat(changed).isSameAs(existing);
        assertThat(changed.getParticipationType()).isEqualTo(AttendanceParticipationType.HOST);
    }

    @Test
    void rejectsAttendanceAfterTheMemberWithdrawalDate() {
        Gathering gathering = openGathering();
        Member member = new Member("회원", null, LocalDate.of(2026, 1, 1), null);
        member.withdraw(LocalDate.of(2026, 8, 19));
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));
        when(memberService.findById(member.getId())).thenReturn(member);

        assertThatThrownBy(() -> attendanceService.recordAttendance(
                gathering.getId(), member.getId(), AttendanceParticipationType.COUPON))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("탈퇴일 이후");
    }

    @Test
    void rejectsAttendanceForCancelledGathering() {
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);
        gathering.cancel("운영상 취소했습니다.");
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));

        assertThatThrownBy(() -> attendanceService.recordAttendance(
                gathering.getId(), UUID.randomUUID(), AttendanceParticipationType.NORMAL))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("열린 모임");
    }

    @Test
    void returnsAttendanceHistoryForWithdrawnMember() {
        Member member = new Member("회원", null, LocalDate.of(2026, 1, 1), null);
        member.withdraw(LocalDate.of(2026, 8, 19));
        Attendance attendance = new Attendance(
                UUID.randomUUID(), member.getId(), AttendanceParticipationType.NORMAL);
        AttendanceService attendanceService = service();
        when(memberService.findById(member.getId())).thenReturn(member);
        when(attendanceRepository.findByMemberIdOrderByRecordedAtDesc(member.getId()))
                .thenReturn(List.of(attendance));

        assertThat(attendanceService.findMemberAttendanceHistory(member.getId())).containsExactly(attendance);
    }

    private AttendanceService service() {
        return new AttendanceService(gatheringRepository, attendanceRepository, memberService);
    }

    private Gathering openGathering() {
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);
        gathering.open();
        return gathering;
    }
}
