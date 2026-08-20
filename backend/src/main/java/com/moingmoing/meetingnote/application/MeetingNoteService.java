package com.moingmoing.meetingnote.application;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.meetingnote.domain.MeetingNote;
import com.moingmoing.meetingnote.domain.MeetingNoteStatus;
import com.moingmoing.meetingnote.infrastructure.MeetingNoteRepository;

@Service
@Transactional
public class MeetingNoteService {
    private final MeetingNoteRepository repository;

    public MeetingNoteService(MeetingNoteRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<MeetingNote> findPublished(UUID categoryId) {
        if (categoryId == null) {
            return repository.findAllByNoteStatusOrderByCreatedAtDesc(MeetingNoteStatus.PUBLISHED);
        }
        return repository.findAllByCategoryIdAndNoteStatusOrderByCreatedAtDesc(
                categoryId,
                MeetingNoteStatus.PUBLISHED);
    }

    @Transactional(readOnly = true)
    public MeetingNote findById(UUID noteId) {
        return repository.findById(noteId)
                .orElseThrow(() -> new IllegalArgumentException("Meeting note not found."));
    }

    public MeetingNote create(UUID categoryId, String title, String markdownContent) {
        return repository.save(new MeetingNote(categoryId, title, markdownContent));
    }

    public MeetingNote update(UUID noteId, UUID categoryId, String title, String markdownContent) {
        MeetingNote note = findById(noteId);
        note.update(categoryId, title, markdownContent);
        return note;
    }

    public MeetingNote hide(UUID noteId) {
        MeetingNote note = findById(noteId);
        note.hide();
        return note;
    }
}
