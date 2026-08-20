package com.moingmoing.meetingnote.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "meeting_note_categories")
public class MeetingNoteCategory {
    @Id
    private UUID id;
    private String name;
    private String color;
    private int sortOrder;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    protected MeetingNoteCategory() {
    }

    public MeetingNoteCategory(String name, String color, int sortOrder) {
        this.id = UUID.randomUUID();
        this.name = name;
        this.color = color;
        this.sortOrder = sortOrder;
        this.active = true;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getColor() {
        return color;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public boolean isActive() {
        return active;
    }

    public void update(String name, String color, int sortOrder) {
        this.name = name;
        this.color = color;
        this.sortOrder = sortOrder;
        this.updatedAt = Instant.now();
    }

    /**
     * Keeps the category row so that existing meeting notes retain their historical category reference.
     */
    public void deactivate() {
        active = false;
        updatedAt = Instant.now();
    }
}
