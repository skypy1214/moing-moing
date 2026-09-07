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
import com.moingmoing.attendance.domain.AttendancePaymentStatus;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.domain.GatheringType;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.application.MemberService;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberRole;
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
        return createGathering(
                heldOn, gatheringType, endsOn, hostMemberId, title, startsAt, location, 0);
    }

    public Gathering createGathering(
            LocalDate heldOn,
            GatheringType gatheringType,
            LocalDate endsOn,
            UUID hostMemberId,
            String title,
            Instant startsAt,
            String location,
            int defaultParticipationFee) {
        if (gatheringType == GatheringType.EVENT && hostMemberId != null) {
            throw new IllegalArgumentException("Only classes can have a host.");
        }
        Gathering gathering = gatheringRepository.save(
                new Gathering(
                        heldOn, gatheringType, endsOn, title, startsAt, location, defaultParticipationFee));
        if (hostMemberId != null) {
            Member host = memberService.findById(hostMemberId);
            validateMemberCanAttend(gathering, host);
            attendanceRepository.save(new Attendance(
                    gathering.getId(),
                    hostMemberId,
                    AttendanceParticipationType.HOST,
                    0));
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
        return updateGathering(
                gatheringId, heldOn, gatheringType, endsOn, hostMemberId, title, startsAt, location, 0);
    }

    public Gathering updateGathering(
            UUID gatheringId,
            LocalDate heldOn,
            GatheringType gatheringType,
            LocalDate endsOn,
            UUID hostMemberId,
            String title,
            Instant startsAt,
            String location,
            int defaultParticipationFee) {
        if (gatheringType == GatheringType.EVENT && hostMemberId != null) {
            throw new IllegalArgumentException("Only classes can have a host.");
        }
        Gathering gathering = findGathering(gatheringId);
        gathering.updateDetails(
                heldOn, gatheringType, endsOn, title, startsAt, location, defaultParticipationFee);
        attendanceRepository.findByGatheringIdOrderByRecordedAtAsc(gatheringId)
                .forEach(attendance -> applyDefaultFeePolicy(attendance, defaultParticipationFee));
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
                        gathering.getId(),
                        hostMemberId,
                        AttendanceParticipationType.HOST,
                        0)));
        if (hostAttendance.getAttendanceStatus() == AttendanceStatus.CANCELLED) {
            hostAttendance.recordAgain(AttendanceParticipationType.HOST);
        } else if (hostAttendance.getParticipationType() != AttendanceParticipationType.HOST) {
            hostAttendance.changeParticipationType(AttendanceParticipationType.HOST);
        }
        hostAttendance.updatePayment(0, AttendancePaymentStatus.EXEMPT);
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

    @Transactional(readOnly = true)
    public List<Attendance> findUnpaidAttendances() {
        return attendanceRepository.findByAttendanceStatusAndPaymentStatusOrderByRecordedAtDesc(
                        AttendanceStatus.RECORDED, AttendancePaymentStatus.PENDING)
                .stream()
                .filter(attendance -> findGathering(attendance.getGatheringId()).getGatheringStatus()
                        != GatheringStatus.CANCELLED)
                .toList();
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
            if (participationType == AttendanceParticipationType.COUPON) {
                existingAttendance.updatePayment(0, AttendancePaymentStatus.EXEMPT);
            } else if (hasDefaultFeeExemption(member)) {
                existingAttendance.applyRoleFeeExemption();
            }
            return existingAttendance;
        }
        int appliedFee = participationType == AttendanceParticipationType.COUPON
                        || hasDefaultFeeExemption(member)
                ? 0
                : gathering.getDefaultParticipationFee();
        return attendanceRepository.save(
                new Attendance(gatheringId, memberId, participationType, appliedFee));
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

    public Attendance updateAttendancePayment(
            UUID gatheringId,
            UUID attendanceId,
            int appliedFee,
            AttendancePaymentStatus paymentStatus) {
        Gathering gathering = findGathering(gatheringId);
        if (gathering.getGatheringStatus() == GatheringStatus.CANCELLED) {
            throw new IllegalArgumentException("취소된 모임의 입금 정보는 변경할 수 없습니다.");
        }
        Attendance attendance = attendanceRepository.findById(attendanceId)
                .filter(found -> found.getGatheringId().equals(gatheringId))
                .orElseThrow(() -> new AttendanceNotFoundException(attendanceId));
        if (attendance.getAttendanceStatus() == AttendanceStatus.CANCELLED) {
            throw new IllegalArgumentException("취소된 출석의 입금 정보는 변경할 수 없습니다.");
        }
        if (attendance.getParticipationType() == AttendanceParticipationType.HOST
                && (appliedFee != 0 || paymentStatus != AttendancePaymentStatus.EXEMPT)) {
            throw new IllegalArgumentException("진행자는 참가비를 내지 않습니다.");
        }
        attendance.updatePayment(appliedFee, paymentStatus);
        return attendance;
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

    private void applyDefaultFeePolicy(Attendance attendance, int defaultParticipationFee) {
        if (attendance.getParticipationType() != AttendanceParticipationType.NORMAL) {
            return;
        }
        Member member = memberService.findById(attendance.getMemberId());
        if (hasDefaultFeeExemption(member)) {
            attendance.applyRoleFeeExemption();
            return;
        }
        attendance.applyDefaultParticipationFee(defaultParticipationFee);
    }

    private boolean hasDefaultFeeExemption(Member member) {
        return member.getMemberRole() == MemberRole.LEADER
                || member.getMemberRole() == MemberRole.STAFF;
    }
}
