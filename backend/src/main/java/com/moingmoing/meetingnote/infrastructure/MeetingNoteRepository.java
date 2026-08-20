package com.moingmoing.meetingnote.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.meetingnote.domain.MeetingNote;
import com.moingmoing.meetingnote.domain.MeetingNoteStatus;

public interface MeetingNoteRepository extends JpaRepository<MeetingNote, UUID> {
    List<MeetingNote> findAllByOrderByCreatedAtDesc();

    List<MeetingNote> findAllByNoteStatusOrderByCreatedAtDesc(MeetingNoteStatus noteStatus);

    List<MeetingNote> findAllByCategoryIdAndNoteStatusOrderByCreatedAtDesc(
            UUID categoryId,
            MeetingNoteStatus noteStatus);
}
