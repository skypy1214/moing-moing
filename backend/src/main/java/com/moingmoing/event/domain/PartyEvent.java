package com.moingmoing.event.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "party_events")
public class PartyEvent {
  @Id private UUID id;
  private String name;

  @Enumerated(EnumType.STRING)
  private PartyEventStatus eventStatus;

  private Instant createdAt;
  private Instant updatedAt;

  protected PartyEvent() { }

  public PartyEvent(String n, PartyEventStatus s) {
    id = UUID.randomUUID();
    name = n;
    eventStatus = s;
    createdAt = Instant.now();
    updatedAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public PartyEventStatus getEventStatus() {
    return eventStatus;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public void update(String n, PartyEventStatus s) {
    name = n;
    eventStatus = s;
    updatedAt = Instant.now();
  }

  public void delete() {
    eventStatus = PartyEventStatus.DELETED;
    updatedAt = Instant.now();
  }
}
