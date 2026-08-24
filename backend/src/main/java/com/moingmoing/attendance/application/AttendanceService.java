package com.moingmoing.attendance.application;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.domain.GatheringType;
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
        return gatheringRepository.findByGatheringStatusNotOrderByHeldOnDesc(GatheringStatus.CANCELLED);
    }

    @Transactional(readOnly = true)
    public Page<Gathering> findCancelledGatherings(int page, int size) {
        return gatheringRepository.findByGatheringStatusOrderByCancelledAtDesc(
                GatheringStatus.CANCELLED, PageRequest.of(page, size));
    }

    public Gathering createGathering(
            LocalDate heldOn,
            GatheringType gatheringType,
            LocalDate endsOn,
            UUID hostMemberId,
            String title,
            Instant startsAt,
            String location) {
        if (gatheringType == GatheringType.EVENT && hostMemberId != null) {
            throw new IllegalArgumentException("Only classes can have a host.");
        }
        Gathering gathering = gatheringRepository.save(
                new Gathering(heldOn, gatheringType, endsOn, title, startsAt, location));
        if (hostMemberId != null) {
            Member host = memberService.findById(hostMemberId);
            validateMemberCanAttend(gathering, host);
            attendanceRepository.save(new Attendance(
                    gathering.getId(), hostMemberId, AttendanceParticipationType.HOST));
        }
        return gathering;
    }

    public Gathering updateGathering(
            UUID gatheringId,
            LocalDate heldOn,
            GatheringType gatheringType,
            LocalDate endsOn,
            UUID hostMemberId,
            String title,
            Instant startsAt,
            String location) {
        if (gatheringType == GatheringType.EVENT && hostMemberId != null) {
            throw new IllegalArgumentException("Only classes can have a host.");
        }
        Gathering gathering = findGathering(gatheringId);
        gathering.updateDetails(heldOn, gatheringType, endsOn, title, startsAt, location);
        updateHostAttendance(gathering, hostMemberId);
        return gathering;
    }

    private void updateHostAttendance(Gathering gathering, UUID hostMemberId) {
        List<Attendance> existingHostAttendances = attendanceRepository
                .findByGatheringIdOrderByRecordedAtAsc(gathering.getId()).stream()
                .filter(attendance -> attendance.getParticipationType() == AttendanceParticipationType.HOST)
                .toList();
        if (hostMemberId == null) {
            attendanceRepository.deleteAll(existingHostAttendances);
            return;
        }

        Member host = memberService.findById(hostMemberId);
        validateMemberCanAttend(gathering, host);
        Attendance hostAttendance = attendanceRepository
                .findByGatheringIdAndMemberId(gathering.getId(), hostMemberId)
                .orElseGet(() -> attendanceRepository.save(new Attendance(
                        gathering.getId(), hostMemberId, AttendanceParticipationType.HOST)));
        if (hostAttendance.getAttendanceStatus() == AttendanceStatus.CANCELLED) {
            hostAttendance.recordAgain(AttendanceParticipationType.HOST);
        } else if (hostAttendance.getParticipationType() != AttendanceParticipationType.HOST) {
            hostAttendance.changeParticipationType(AttendanceParticipationType.HOST);
        }
        attendanceRepository.deleteAll(existingHostAttendances.stream()
                .filter(attendance -> !attendance.getId().equals(hostAttendance.getId()))
                .toList());
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

    public Gathering reopenGathering(UUID gatheringId) {
        Gathering gathering = findGathering(gatheringId);
        gathering.reopen();
        return gathering;
    }

    public Gathering cancelGathering(UUID gatheringId, String cancellationReason) {
        Gathering gathering = findGathering(gatheringId);
        gathering.cancel(cancellationReason);
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
        validateMemberCanAttend(gathering, member);
        Attendance existingAttendance = attendanceRepository
                .findByGatheringIdAndMemberId(gatheringId, memberId)
                .orElse(null);
        if (existingAttendance != null) {
            if (existingAttendance.getAttendanceStatus() == AttendanceStatus.CANCELLED) {
                existingAttendance.recordAgain(participationType);
            } else {
                existingAttendance.changeParticipationType(participationType);
            }
            return existingAttendance;
        }
        return attendanceRepository.save(new Attendance(gatheringId, memberId, participationType));
    }

    public Attendance cancelAttendance(UUID gatheringId, UUID attendanceId, String cancellationReason) {
        Gathering gathering = findGathering(gatheringId);
        requireOpenGathering(gathering);
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

    public void deleteAttendance(UUID gatheringId, UUID attendanceId) {
        Gathering gathering = findGathering(gatheringId);
        requireOpenGathering(gathering);
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .filter(found -> found.getGatheringId().equals(gatheringId))
                .orElseThrow(() -> new AttendanceNotFoundException(attendanceId));
        if (attendance.getParticipationType() == AttendanceParticipationType.COUPON) {
            // Coupon attendance must retain its linked coupon-usage audit trail.
            throw new IllegalArgumentException("Coupon attendance must be reversed from the coupon usage.");
        }
        attendanceRepository.delete(attendance);
    }

    private Gathering findGathering(UUID gatheringId) {
        return gatheringRepository.findById(gatheringId)
                .orElseThrow(() -> new GatheringNotFoundException(gatheringId));
    }

    private void requireOpenGathering(Gathering gathering) {
        if (gathering.getGatheringStatus() != GatheringStatus.OPEN) {
            throw new IllegalArgumentException("Attendance can only be changed while the gathering is open.");
        }
    }

    private void validateMemberCanAttend(Gathering gathering, Member member) {
        if (member.getMembershipStatus() == MembershipStatus.WITHDRAWN
                && gathering.getHeldOn().isAfter(member.getWithdrawnOn())) {
            throw new IllegalArgumentException("탈퇴일 이후에는 출석을 기록할 수 없습니다.");
        }
    }
}
