package com.moingmoing.event.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "party_role_assignments")
public class PartyRoleAssignment {
  @Id private UUID id;
  private UUID eventId;
  private UUID partyRoleId;
  private UUID userAccountId;
  private Instant confirmedAt;

  protected PartyRoleAssignment() { }

  public PartyRoleAssignment(UUID eventId, UUID partyRoleId, UUID userAccountId) {
    id = UUID.randomUUID();
    this.eventId = eventId;
    this.partyRoleId = partyRoleId;
    this.userAccountId = userAccountId;
    confirmedAt = Instant.now();
  }

  public UUID getPartyRoleId() {
    return partyRoleId;
  }

  public UUID getUserAccountId() {
    return userAccountId;
  }
}
