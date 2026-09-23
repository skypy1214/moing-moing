package com.moingmoing.attendance.application;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.domain.Attendance;
import com.moingmoing.attendance.domain.AttendanceParticipationType;
import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.ClassSeries;
import com.moingmoing.attendance.domain.ClassSeriesEnrollment;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.domain.GatheringType;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.ClassSeriesEnrollmentRepository;
import com.moingmoing.attendance.infrastructure.ClassSeriesRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.application.MemberService;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MembershipStatus;

@Service
@Transactional
public class ClassSeriesService {
    private final ClassSeriesRepository classSeriesRepository;
    private final ClassSeriesEnrollmentRepository enrollmentRepository;
    private final GatheringRepository gatheringRepository;
    private final AttendanceRepository attendanceRepository;
    private final MemberService memberService;

    public ClassSeriesService(
            ClassSeriesRepository classSeriesRepository,
            ClassSeriesEnrollmentRepository enrollmentRepository,
            GatheringRepository gatheringRepository,
            AttendanceRepository attendanceRepository,
            MemberService memberService) {
        this.classSeriesRepository = classSeriesRepository;
        this.enrollmentRepository = enrollmentRepository;
        this.gatheringRepository = gatheringRepository;
        this.attendanceRepository = attendanceRepository;
        this.memberService = memberService;
    }

    public CreatedClassSeries create(
            LocalDate startsOn,
            UUID hostMemberId,
            String title,
            String location,
            int sessionFee,
            int sessionCount) {
        ClassSeries series = classSeriesRepository.save(
                new ClassSeries(title, startsOn, sessionCount, sessionFee));
        List<Gathering> gatherings = java.util.stream.IntStream.range(0, sessionCount)
                .mapToObj(index -> createGathering(series, startsOn.plusWeeks(index), title, location))
                .toList();
        if (hostMemberId != null) {
            Member host = memberService.findById(hostMemberId);
            validateMemberCanAttend(host, startsOn);
            gatherings.forEach(gathering -> attendanceRepository.save(new Attendance(
                    gathering.getId(), hostMemberId, AttendanceParticipationType.HOST, 0)));
        }
        return new CreatedClassSeries(series, gatherings);
    }

    @Transactional(readOnly = true)
    public ClassSeries findById(UUID seriesId) {
        return classSeriesRepository.findById(seriesId)
                .orElseThrow(() -> new ClassSeriesNotFoundException(seriesId));
    }

    @Transactional(readOnly = true)
    public List<ClassSeriesEnrollment> findEnrollments(UUID seriesId) {
        findById(seriesId);
        return enrollmentRepository.findByClassSeriesIdOrderByCreatedAtAsc(seriesId);
    }

    public ClassSeriesEnrollment enroll(UUID seriesId, UUID memberId, Integer paidAmount) {
        ClassSeries series = findById(seriesId);
        int amount = paidAmount == null ? series.getTotalFee() : paidAmount;
        return enrollWithPaidOn(series, memberId, amount, LocalDate.now());
    }

    public CreatedClassSeries convertExisting(
            List<UUID> gatheringIds,
            String title,
            int sessionFee,
            List<UUID> prepaidMemberIds) {
        if (gatheringIds == null || gatheringIds.size() < 2 || gatheringIds.size() > 24) {
            throw new IllegalArgumentException("기존 수업은 2회부터 24회까지 선택해 주세요.");
        }
        if (gatheringIds.stream().distinct().count() != gatheringIds.size()) {
            throw new IllegalArgumentException("같은 수업을 중복 선택할 수 없습니다.");
        }
        List<Gathering> gatherings = gatheringRepository.findAllById(gatheringIds).stream()
                .sorted(java.util.Comparator.comparing(Gathering::getHeldOn))
                .toList();
        if (gatherings.size() != gatheringIds.size()) {
            throw new IllegalArgumentException("선택한 수업을 찾을 수 없습니다.");
        }
        if (gatherings.stream().anyMatch(gathering -> gathering.getGatheringType() != GatheringType.CLASS
                || gathering.getClassSeriesId() != null
                || (gathering.getGatheringStatus() != GatheringStatus.DRAFT
                        && gathering.getGatheringStatus() != GatheringStatus.OPEN))) {
            throw new IllegalArgumentException("출석이 종료되지 않은 수업만 묶을 수 있습니다.");
        }

        ClassSeries series = classSeriesRepository.save(new ClassSeries(
                title, gatherings.getFirst().getHeldOn(), gatherings.size(), sessionFee));
        gatherings.forEach(gathering -> gathering.assignClassSeries(series.getId()));
        for (UUID memberId : prepaidMemberIds == null ? List.<UUID>of() : prepaidMemberIds) {
            enrollWithPaidOn(series, memberId, series.getTotalFee(), series.getStartsOn());
            gatherings.forEach(gathering -> attendanceRepository
                    .findByGatheringIdAndMemberId(gathering.getId(), memberId)
                    .filter(attendance -> attendance.getAttendanceStatus() == AttendanceStatus.RECORDED)
                    .filter(attendance -> attendance.getParticipationType() == AttendanceParticipationType.NORMAL)
                    .ifPresent(Attendance::applyPrepayment));
        }
        return new CreatedClassSeries(series, gatherings);
    }

    @Transactional(readOnly = true)
    public boolean hasEnrollment(UUID seriesId, UUID memberId) {
        return enrollmentRepository.findByClassSeriesIdAndMemberId(seriesId, memberId).isPresent();
    }

    private ClassSeriesEnrollment enrollWithPaidOn(
            ClassSeries series, UUID memberId, int paidAmount, LocalDate paidOn) {
        Member member = memberService.findById(memberId);
        validateMemberCanAttend(member, series.getStartsOn());
        if (enrollmentRepository.findByClassSeriesIdAndMemberId(series.getId(), memberId).isPresent()) {
            throw new IllegalArgumentException("이미 선납 회원으로 등록된 회원입니다.");
        }
        return enrollmentRepository.save(new ClassSeriesEnrollment(
                series.getId(), memberId, paidAmount, paidOn));
    }

    private Gathering createGathering(
            ClassSeries series, LocalDate heldOn, String title, String location) {
        return gatheringRepository.save(new Gathering(
                heldOn,
                GatheringType.CLASS,
                null,
                title,
                null,
                location,
                series.getSessionFee(),
                series.getId()));
    }

    private void validateMemberCanAttend(Member member, LocalDate heldOn) {
        if (member.getMembershipStatus() == MembershipStatus.WITHDRAWN
                && heldOn.isAfter(member.getWithdrawnOn())) {
            throw new IllegalArgumentException("탈퇴일 이후에는 수업에 등록할 수 없습니다.");
        }
    }

    public record CreatedClassSeries(ClassSeries series, List<Gathering> gatherings) {
    }
}
