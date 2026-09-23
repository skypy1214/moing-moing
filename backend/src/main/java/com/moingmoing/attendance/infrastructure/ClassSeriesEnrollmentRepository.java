package com.moingmoing.attendance.infrastructure;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.attendance.domain.ClassSeriesEnrollment;

public interface ClassSeriesEnrollmentRepository extends JpaRepository<ClassSeriesEnrollment, UUID> {
    List<ClassSeriesEnrollment> findByClassSeriesIdOrderByCreatedAtAsc(UUID classSeriesId);
    Optional<ClassSeriesEnrollment> findByClassSeriesIdAndMemberId(UUID classSeriesId, UUID memberId);
    List<ClassSeriesEnrollment> findByPaidOnBetween(LocalDate startsOn, LocalDate endsOn);
}
