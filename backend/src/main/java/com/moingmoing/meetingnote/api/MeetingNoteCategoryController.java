package com.moingmoing.meetingnote.api;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.meetingnote.application.MeetingNoteCategoryService;
import com.moingmoing.meetingnote.domain.MeetingNoteCategory;

@RestController
@RequestMapping("/api/v1/meeting-note-categories")
class MeetingNoteCategoryController {
    private final MeetingNoteCategoryService service;

    MeetingNoteCategoryController(MeetingNoteCategoryService service) {
        this.service = service;
    }

    @GetMapping
    List<CategoryResponse> list() {
        return service.findAll().stream()
                .map(CategoryResponse::from)
                .toList();
    }

    @PostMapping
    CategoryResponse create(@Valid @RequestBody CategoryRequest request) {
        MeetingNoteCategory category = service.create(
                request.name(),
                request.color(),
                request.sortOrder());
        return CategoryResponse.from(category);
    }

    @PutMapping("/{id}")
    CategoryResponse update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest request) {
        MeetingNoteCategory category = service.update(
                id,
                request.name(),
                request.color(),
                request.sortOrder());
        return CategoryResponse.from(category);
    }

    @PostMapping("/{id}/deactivate")
    CategoryResponse deactivate(@PathVariable UUID id) {
        return CategoryResponse.from(service.deactivate(id));
    }
}

record CategoryRequest(
        @NotBlank String name,
        @Pattern(regexp = "#[0-9A-Fa-f]{6}") String color,
        @Min(0) int sortOrder) {
}

record CategoryResponse(UUID id, String name, String color, int sortOrder, boolean active) {
    static CategoryResponse from(MeetingNoteCategory category) {
        return new CategoryResponse(
                category.getId(),
                category.getName(),
                category.getColor(),
                category.getSortOrder(),
                category.isActive());
    }
}
