package com.moingmoing.attendance.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.attendance.domain.Gathering;
import com.moingmoing.attendance.domain.GatheringStatus;

public interface GatheringRepository extends JpaRepository<Gathering, UUID> {
    List<Gathering> findByGatheringStatusNotOrderByHeldOnDesc(GatheringStatus gatheringStatus);

    Page<Gathering> findByGatheringStatusOrderByCancelledAtDesc(GatheringStatus gatheringStatus, Pageable pageable);
}
