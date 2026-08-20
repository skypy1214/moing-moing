package com.moingmoing.attendance.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.attendance.domain.Gathering;

public interface GatheringRepository extends JpaRepository<Gathering, UUID> {
    List<Gathering> findAllByOrderByHeldOnDesc();
}
