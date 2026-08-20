package com.moingmoing.meetingnote.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;

import org.junit.jupiter.api.Test;

class MeetingNoteTest {
    @Test
    void creates_a_published_note() {
        MeetingNote note = new MeetingNote(UUID.randomUUID(), "Planning", "# Agenda");

        assertEquals(MeetingNoteStatus.PUBLISHED, note.getNoteStatus());
        assertNotNull(note.getCreatedAt());
        assertEquals(note.getCreatedAt(), note.getUpdatedAt());
    }

    @Test
    void updates_the_content_without_changing_the_note_identity() {
        MeetingNote note = new MeetingNote(UUID.randomUUID(), "Before", "Old content");
        UUID noteId = note.getId();
        UUID newCategoryId = UUID.randomUUID();

        note.update(newCategoryId, "After", "New content");

        assertEquals(noteId, note.getId());
        assertEquals(newCategoryId, note.getCategoryId());
        assertEquals("After", note.getTitle());
        assertEquals("New content", note.getMarkdownContent());
    }

    @Test
    void hides_instead_of_deleting_the_original_markdown() {
        MeetingNote note = new MeetingNote(UUID.randomUUID(), "Record", "Original content");

        note.hide();

        assertEquals(MeetingNoteStatus.HIDDEN, note.getNoteStatus());
        assertEquals("Original content", note.getMarkdownContent());
        assertNotNull(note.getHiddenAt());
        assertEquals(note.getHiddenAt(), note.getUpdatedAt());
    }

    @Test
    void rejects_hiding_an_already_hidden_note() {
        MeetingNote note = new MeetingNote(UUID.randomUUID(), "Record", "Content");
        note.hide();

        assertThrows(IllegalArgumentException.class, note::hide);
    }
}
