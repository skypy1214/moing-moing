package com.moingmoing.event.infrastructure;

import com.moingmoing.event.domain.PartyRoleAssignment;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PartyRoleAssignmentRepository extends JpaRepository<PartyRoleAssignment, UUID> {
  List<PartyRoleAssignment> findAllByEventId(UUID eventId);

  Optional<PartyRoleAssignment> findByEventIdAndUserAccountId(UUID eventId, UUID accountId);

  boolean existsByPartyRoleId(UUID roleId);

  void deleteByPartyRoleId(UUID roleId);

  long deleteByEventIdAndPartyRoleId(UUID eventId, UUID roleId);

  @Modifying
  @Query(
      value =
          "insert into"
              + " party_role_assignments(id,event_id,party_role_id,user_account_id,confirmed_at)"
              + " values(:id,:eventId,:roleId,:accountId,current_timestamp) on conflict do nothing",
      nativeQuery = true)
  int claim(
      @Param("id") UUID id,
      @Param("eventId") UUID eventId,
      @Param("roleId") UUID roleId,
      @Param("accountId") UUID accountId);
}
