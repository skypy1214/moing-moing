package com.moingmoing.meetingnote.infrastructure;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.moingmoing.meetingnote.domain.MeetingNoteCategory;

public interface MeetingNoteCategoryRepository extends JpaRepository<MeetingNoteCategory, UUID> {
    List<MeetingNoteCategory> findAllByOrderBySortOrderAscNameAsc();
}
