package com.moingmoing.meetingnote.application;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.moingmoing.meetingnote.domain.MeetingNoteCategory;
import com.moingmoing.meetingnote.infrastructure.MeetingNoteCategoryRepository;

@Service
@Transactional
public class MeetingNoteCategoryService {
    private final MeetingNoteCategoryRepository repository;

    public MeetingNoteCategoryService(MeetingNoteCategoryRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<MeetingNoteCategory> findAll() {
        return repository.findAllByOrderBySortOrderAscNameAsc();
    }

    public MeetingNoteCategory create(String name, String color, int sortOrder) {
        MeetingNoteCategory category = new MeetingNoteCategory(name, color, sortOrder);
        return repository.save(category);
    }

    public MeetingNoteCategory update(UUID id, String name, String color, int sortOrder) {
        MeetingNoteCategory category = find(id);
        category.update(name, color, sortOrder);
        return category;
    }

    public MeetingNoteCategory deactivate(UUID id) {
        MeetingNoteCategory category = find(id);
        category.deactivate();
        return category;
    }

    @Transactional(readOnly = true)
    public MeetingNoteCategory findActiveById(UUID id) {
        MeetingNoteCategory category = find(id);
        if (!category.isActive()) {
            throw new IllegalArgumentException("Inactive meeting note categories cannot be assigned to a note.");
        }
        return category;
    }

    private MeetingNoteCategory find(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Meeting note category not found."));
    }
}
