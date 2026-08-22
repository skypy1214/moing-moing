package com.moingmoing.attendance.infrastructure;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.attendance.domain.Attendance;

public interface AttendanceRepository extends JpaRepository<Attendance, UUID> {

    Optional<Attendance> findByGatheringIdAndMemberId(UUID gatheringId, UUID memberId);

    List<Attendance> findByGatheringIdOrderByRecordedAtAsc(UUID gatheringId);

    List<Attendance> findByMemberIdOrderByRecordedAtDesc(UUID memberId);
}
