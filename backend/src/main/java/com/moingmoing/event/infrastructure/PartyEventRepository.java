package com.moingmoing.event.infrastructure;

import com.moingmoing.event.domain.PartyEvent;
import com.moingmoing.event.domain.PartyEventStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartyEventRepository extends JpaRepository<PartyEvent, UUID> {
  List<PartyEvent> findAllByEventStatusNotOrderByCreatedAtDesc(PartyEventStatus status);

  List<PartyEvent> findAllByEventStatusOrderByCreatedAtDesc(PartyEventStatus status);
}
