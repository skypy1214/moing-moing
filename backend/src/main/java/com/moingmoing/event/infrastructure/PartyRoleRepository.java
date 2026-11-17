package com.moingmoing.event.infrastructure;

import com.moingmoing.event.domain.PartyRole;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PartyRoleRepository extends JpaRepository<PartyRole, UUID> {
  List<PartyRole> findAllByEventIdOrderByDisplayOrderAsc(UUID eventId);

  Optional<PartyRole> findByIdAndEventId(UUID id, UUID eventId);

  Optional<PartyRole> findTopByEventIdOrderByDisplayOrderDesc(UUID eventId);
}
