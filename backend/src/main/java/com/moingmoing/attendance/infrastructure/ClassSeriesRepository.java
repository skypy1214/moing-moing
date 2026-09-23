package com.moingmoing.attendance.infrastructure;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.attendance.domain.ClassSeries;

public interface ClassSeriesRepository extends JpaRepository<ClassSeries, UUID> {
}
