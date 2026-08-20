package com.moingmoing.attendance.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.application.MemberService;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MembershipStatus;

@Service
@Transactional
public class AttendanceService {
    private final GatheringRepository gatheringRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberService memberService;

    public AttendanceService(
            GatheringRepository gatheringRepository,
            AttendanceRepository attendanceRepository,
            MemberService memberService) {
        this.gatheringRepository = gatheringRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberService = memberService;
    }

    @Transactional(readOnly = true)
    public List<Gathering> findGatherings() {
        return gatheringRepository.findAllByOrderByHeldOnDesc();
    }

    public Gathering createGathering(LocalDate heldOn, String title, Instant startsAt, String location) {
        return gatheringRepository.save(new Gathering(heldOn, title, startsAt, location));
    }

    public Gathering openGathering(UUID gatheringId) {
        Gathering gathering = findGathering(gatheringId);
        gathering.open();
        return gathering;
    }

    public Gathering closeGathering(UUID gatheringId) {
        Gathering gathering = findGathering(gatheringId);
        gathering.close();
        return gathering;
    }

    public Gathering cancelGathering(UUID gatheringId) {
        Gathering gathering = findGathering(gatheringId);
        gathering.cancel();
        return gathering;
    }

    @Transactional(readOnly = true)
    public List<Attendance> findAttendances(UUID gatheringId) {
        findGathering(gatheringId);
        return attendanceRepository.findByGatheringIdOrderByRecordedAtAsc(gatheringId);
    }

    @Transactional(readOnly = true)
    public List<Attendance> findMemberAttendanceHistory(UUID memberId) {
        memberService.findById(memberId);
        return attendanceRepository.findByMemberIdOrderByRecordedAtDesc(memberId);
    }

    public Attendance recordAttendance(
            UUID gatheringId, UUID memberId, AttendanceParticipationType participationType) {
        Gathering gathering = findGathering(gatheringId);
        if (gathering.getGatheringStatus() != GatheringStatus.OPEN) {
            throw new IllegalArgumentException("열린 모임에만 출석을 기록할 수 있습니다.");
        }
        Member member = memberService.findById(memberId);
        if (member.getMembershipStatus() == MembershipStatus.WITHDRAWN
                && gathering.getHeldOn().isAfter(member.getWithdrawnOn())) {
            throw new IllegalArgumentException("탈퇴일 이후에는 출석을 기록할 수 없습니다.");
        }
        if (attendanceRepository.existsByGatheringIdAndMemberId(gatheringId, memberId)) {
            throw new IllegalArgumentException("이미 해당 모임의 출석 기록이 있습니다.");
        }
        return attendanceRepository.save(new Attendance(gatheringId, memberId, participationType));
    }

    public Attendance cancelAttendance(UUID gatheringId, UUID attendanceId, String cancellationReason) {
        findGathering(gatheringId);
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .filter(found -> found.getGatheringId().equals(gatheringId))
                .orElseThrow(() -> new AttendanceNotFoundException(attendanceId));
        if (attendance.getParticipationType() == AttendanceParticipationType.COUPON) {
            // Coupon attendance must be reversed through CouponUsage so the balance and audit trail change together.
            throw new IllegalArgumentException("Coupon attendance must be reversed from the coupon usage.");
        }
        attendance.cancel(cancellationReason);
        return attendance;
    }

    private Gathering findGathering(UUID gatheringId) {
        return gatheringRepository.findById(gatheringId)
                .orElseThrow(() -> new GatheringNotFoundException(gatheringId));
    }
}
