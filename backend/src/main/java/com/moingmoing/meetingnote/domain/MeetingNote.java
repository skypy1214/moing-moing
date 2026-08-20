package com.moingmoing.meetingnote.domain;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "meeting_notes")
public class MeetingNote {
    @Id
    private UUID id;

    private UUID categoryId;

    private String title;

    private String markdownContent;

    @Enumerated(EnumType.STRING)
    private MeetingNoteStatus noteStatus;

    private Instant hiddenAt;

    private Instant createdAt;

    private Instant updatedAt;

    protected MeetingNote() {
    }

    public MeetingNote(UUID categoryId, String title, String markdownContent) {
        this.id = UUID.randomUUID();
        this.categoryId = categoryId;
        this.title = title;
        this.markdownContent = markdownContent;
        this.noteStatus = MeetingNoteStatus.PUBLISHED;
        this.createdAt = Instant.now();
        this.updatedAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getCategoryId() {
        return categoryId;
    }

    public String getTitle() {
        return title;
    }

    public String getMarkdownContent() {
        return markdownContent;
    }

    public MeetingNoteStatus getNoteStatus() {
        return noteStatus;
    }

    public Instant getHiddenAt() {
        return hiddenAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void update(UUID categoryId, String title, String markdownContent) {
        this.categoryId = categoryId;
        this.title = title;
        this.markdownContent = markdownContent;
        this.updatedAt = Instant.now();
    }

    /**
     * Hides the note instead of deleting it so that the original Markdown and its audit timeline remain available.
     */
    public void hide() {
        if (noteStatus == MeetingNoteStatus.HIDDEN) {
            throw new IllegalArgumentException("Meeting note is already hidden.");
        }

        noteStatus = MeetingNoteStatus.HIDDEN;
        hiddenAt = Instant.now();
        updatedAt = hiddenAt;
    }
}
