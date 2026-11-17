package com.moingmoing.event.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "party_roles")
public class PartyRole {
  @Id private UUID id;

  private UUID eventId;
  private int displayOrder;
  private String name;
  private String description;
  private String mission;
  private Instant createdAt;
  private Instant updatedAt;

  protected PartyRole() { }

  public PartyRole(
      UUID eventId, int displayOrder, String name, String description, String mission) {
    id = UUID.randomUUID();
    this.eventId = eventId;
    this.displayOrder = displayOrder;
    this.name = name;
    this.description = description;
    this.mission = mission;
    createdAt = Instant.now();
    updatedAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getEventId() {
    return eventId;
  }

  public int getDisplayOrder() {
    return displayOrder;
  }

  public String getName() {
    return name;
  }

  public String getDescription() {
    return description;
  }

  public String getMission() {
    return mission;
  }

  public void update(String name, String description, String mission) {
    this.name = name;
    this.description = description;
    this.mission = mission;
    updatedAt = Instant.now();
  }
}
