package com.moingmoing.member.application;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.attendance.domain.AttendanceStatus;
import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;
import com.moingmoing.attendance.infrastructure.AttendanceRepository;
import com.moingmoing.attendance.infrastructure.GatheringRepository;
import com.moingmoing.member.domain.Member;
import com.moingmoing.member.domain.MemberRole;
import com.moingmoing.member.domain.ActivityExclusionReason;
import com.moingmoing.member.domain.MemberActivityExclusion;
import com.moingmoing.member.infrastructure.MemberActivityExclusionRepository;
import com.moingmoing.member.infrastructure.MemberRepository;

@Service
@Transactional
public class MemberService {
    private static final LocalDate OPEN_ENDED_EXCLUSION_END_DATE = LocalDate.of(9999, 12, 31);

    private final MemberRepository memberRepository;
    private final MemberActivityExclusionRepository exclusionRepository;
    private final AttendanceRepository attendanceRepository;
    private final GatheringRepository gatheringRepository;

    public MemberService(
            MemberRepository memberRepository,
            MemberActivityExclusionRepository exclusionRepository,
            AttendanceRepository attendanceRepository,
            GatheringRepository gatheringRepository) {
        this.memberRepository = memberRepository;
        this.exclusionRepository = exclusionRepository;
        this.attendanceRepository = attendanceRepository;
        this.gatheringRepository = gatheringRepository;
    }

    @Transactional(readOnly = true)
    public List<Member> findAll() {
        return memberRepository.findAll();
    }

    @Transactional(readOnly = true)
    public List<MemberAttendanceSummary> findAllWithLastAttendance() {
        List<Member> members = memberRepository.findAll();
        Map<UUID, Gathering> gatheringsById = new HashMap<>();
        for (Gathering gathering : gatheringRepository.findAll()) {
            gatheringsById.put(gathering.getId(), gathering);
        }

        LocalDate today = LocalDate.now();
        Map<UUID, LocalDate> lastAttendanceByMemberId = new HashMap<>();
        attendanceRepository.findAll().forEach(attendance -> {
            Gathering gathering = gatheringsById.get(attendance.getGatheringId());
            if (gathering == null
                    || attendance.getAttendanceStatus() != AttendanceStatus.RECORDED
                    || gathering.getGatheringStatus() == GatheringStatus.CANCELLED
                    || gathering.getHeldOn().isAfter(today)) {
                return;
            }
            lastAttendanceByMemberId.merge(
                    attendance.getMemberId(), gathering.getHeldOn(),
                    (current, candidate) -> current.isAfter(candidate) ? current : candidate);
        });

        return members.stream()
                .map(member -> new MemberAttendanceSummary(
                        member, lastAttendanceByMemberId.get(member.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public Member findById(UUID id) {
        return memberRepository.findById(id).orElseThrow(() -> new MemberNotFoundException(id));
    }

    public Member create(
            String displayName, String externalNickname, LocalDate joinedOn, String memo, MemberRole memberRole) {
        return memberRepository.save(new Member(displayName, externalNickname, joinedOn, memo, memberRole));
    }

    public Member update(
            UUID id,
            String displayName,
            String externalNickname,
            LocalDate joinedOn,
            String memo,
            MemberRole memberRole) {
        Member member = findById(id);
        member.update(displayName, externalNickname, joinedOn, memo, memberRole);
        return member;
    }

    public Member withdraw(UUID id, LocalDate withdrawnOn) {
        Member member = findById(id);
        member.withdraw(withdrawnOn);
        return member;
    }

    public Member reactivate(UUID id, LocalDate joinedOn) {
        Member member = findById(id);
        member.reactivate(joinedOn);
        return member;
    }

    public MemberActivityExclusion startExclusion(
            UUID memberId, ActivityExclusionReason reason, LocalDate startDate, String note) {
        findById(memberId);
        if (exclusionRepository.existsOverlapping(
                memberId, null, startDate, OPEN_ENDED_EXCLUSION_END_DATE)) {
            throw new IllegalArgumentException("기존 활동 제외 기간과 겹칩니다.");
        }
        return exclusionRepository.save(new MemberActivityExclusion(memberId, reason, startDate, note));
    }

    @Transactional(readOnly = true)
    public List<MemberActivityExclusion> findExclusions(UUID memberId) {
        findById(memberId);
        return exclusionRepository.findByMemberIdOrderByStartDateDesc(memberId);
    }

    public MemberActivityExclusion endExclusion(UUID memberId, UUID exclusionId, LocalDate endDate) {
        findById(memberId);
        MemberActivityExclusion exclusion = exclusionRepository.findById(exclusionId)
                .filter(found -> found.getMemberId().equals(memberId))
                .orElseThrow(() -> new MemberNotFoundException(memberId));
        exclusion.close(endDate);
        return exclusion;
    }

    public MemberActivityExclusion updateExclusion(
            UUID memberId,
            UUID exclusionId,
            ActivityExclusionReason reason,
            LocalDate startDate,
            LocalDate endDate,
            String note) {
        findById(memberId);
        MemberActivityExclusion exclusion = findExclusion(memberId, exclusionId);
        if (endDate != null && endDate.isBefore(startDate)) {
            throw new IllegalArgumentException("종료일은 시작일보다 이를 수 없습니다.");
        }
        LocalDate effectiveEndDate = endDate == null ? OPEN_ENDED_EXCLUSION_END_DATE : endDate;
        if (exclusionRepository.existsOverlapping(memberId, exclusionId, startDate, effectiveEndDate)) {
            throw new IllegalArgumentException("기존 활동 제외 기간과 겹칩니다.");
        }
        exclusion.update(reason, startDate, endDate, note);
        return exclusion;
    }

    private MemberActivityExclusion findExclusion(UUID memberId, UUID exclusionId) {
        return exclusionRepository.findById(exclusionId)
                .filter(found -> found.getMemberId().equals(memberId))
                .orElseThrow(() -> new MemberNotFoundException(memberId));
    }
}
