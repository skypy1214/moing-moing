package com.moingmoing.attendance.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.verify;

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
    void recordsTheSelectedHostWhenCreatingAClass() {
        Member host = new Member("진행자", null, LocalDate.of(2026, 1, 1), null);
        AttendanceService attendanceService = service();
        when(gatheringRepository.save(any(Gathering.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(memberService.findById(host.getId())).thenReturn(host);
        when(attendanceRepository.save(any(Attendance.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        Gathering gathering = attendanceService.createGathering(
                LocalDate.of(2026, 8, 20),
                com.moingmoing.attendance.domain.GatheringType.CLASS,
                null,
                host.getId(),
                "정기 수업",
                null,
                null);

        assertThat(gathering.getGatheringStatus()).isEqualTo(com.moingmoing.attendance.domain.GatheringStatus.DRAFT);
        verify(attendanceRepository).save(any(Attendance.class));
    }

    @Test
    void replacesTheHostWhenUpdatingAClass() {
        Gathering gathering = new Gathering(LocalDate.of(2026, 8, 20), null, null, null);
        Member previousHost = new Member("기존 진행자", null, LocalDate.of(2026, 1, 1), null);
        Member newHost = new Member("새 진행자", null, LocalDate.of(2026, 1, 1), null);
        Attendance previousHostAttendance = new Attendance(
                gathering.getId(), previousHost.getId(), AttendanceParticipationType.HOST);
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));
        when(attendanceRepository.findByGatheringIdOrderByRecordedAtAsc(gathering.getId()))
                .thenReturn(List.of(previousHostAttendance));
        when(memberService.findById(newHost.getId())).thenReturn(newHost);
        when(attendanceRepository.findByGatheringIdAndMemberId(gathering.getId(), newHost.getId()))
                .thenReturn(Optional.empty());
        when(attendanceRepository.save(any(Attendance.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        attendanceService.updateGathering(
                gathering.getId(),
                LocalDate.of(2026, 8, 20),
                com.moingmoing.attendance.domain.GatheringType.CLASS,
                null,
                newHost.getId(),
                "정기 수업",
                null,
                null);

        verify(attendanceRepository).deleteAll(List.of(previousHostAttendance));
        verify(attendanceRepository).save(any(Attendance.class));
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

    @Test
    void physicallyDeletesANormalAttendanceAfterItIsExplicitlyRequested() {
        Gathering gathering = openGathering();
        Attendance attendance = new Attendance(
                gathering.getId(), UUID.randomUUID(), AttendanceParticipationType.NORMAL);
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));
        when(attendanceRepository.findById(attendance.getId())).thenReturn(Optional.of(attendance));

        attendanceService.deleteAttendance(gathering.getId(), attendance.getId());

        verify(attendanceRepository).delete(attendance);
    }

    @Test
    void rejectsCancellingAttendanceAfterTheGatheringIsClosed() {
        Gathering gathering = openGathering();
        gathering.close();
        Attendance attendance = new Attendance(
                gathering.getId(), UUID.randomUUID(), AttendanceParticipationType.NORMAL);
        AttendanceService attendanceService = service();
        when(gatheringRepository.findById(gathering.getId())).thenReturn(Optional.of(gathering));

        assertThatThrownBy(() -> attendanceService.cancelAttendance(
                gathering.getId(), attendance.getId(), "입력 오류"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("open");
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
