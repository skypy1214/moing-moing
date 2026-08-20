package com.moingmoing.meetingnote.api;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.meetingnote.application.MeetingNoteCategoryService;
import com.moingmoing.meetingnote.application.MeetingNoteService;
import com.moingmoing.meetingnote.domain.MeetingNote;

@RestController
@RequestMapping("/api/v1/meeting-notes")
class MeetingNoteController {
    private final MeetingNoteService noteService;
    private final MeetingNoteCategoryService categoryService;

    MeetingNoteController(
            MeetingNoteService noteService,
            MeetingNoteCategoryService categoryService) {
        this.noteService = noteService;
        this.categoryService = categoryService;
    }

    @GetMapping
    List<MeetingNoteResponse> list(@RequestParam(required = false) UUID categoryId) {
        return noteService.findPublished(categoryId).stream()
                .map(MeetingNoteResponse::from)
                .toList();
    }

    @GetMapping("/{id}")
    MeetingNoteResponse get(@PathVariable UUID id) {
        return MeetingNoteResponse.from(noteService.findById(id));
    }

    @PostMapping
    ResponseEntity<MeetingNoteResponse> create(@Valid @RequestBody MeetingNoteRequest request) {
        categoryService.findActiveById(request.categoryId());
        MeetingNoteResponse response = MeetingNoteResponse.from(noteService.create(
                request.categoryId(),
                request.title(),
                request.markdownContent()));
        return ResponseEntity.created(URI.create("/api/v1/meeting-notes/" + response.id()))
                .body(response);
    }

    @PutMapping("/{id}")
    MeetingNoteResponse update(@PathVariable UUID id, @Valid @RequestBody MeetingNoteRequest request) {
        categoryService.findActiveById(request.categoryId());
        return MeetingNoteResponse.from(noteService.update(
                id,
                request.categoryId(),
                request.title(),
                request.markdownContent()));
    }

    @PostMapping("/{id}/hide")
    MeetingNoteResponse hide(@PathVariable UUID id) {
        return MeetingNoteResponse.from(noteService.hide(id));
    }
}

record MeetingNoteRequest(
        @NotNull UUID categoryId,
        @NotBlank @Size(max = 200) String title,
        @NotBlank String markdownContent) {
}

record MeetingNoteResponse(
        UUID id,
        UUID categoryId,
        String title,
        String markdownContent,
        String noteStatus,
        Instant hiddenAt,
        Instant createdAt,
        Instant updatedAt) {
    static MeetingNoteResponse from(MeetingNote note) {
        return new MeetingNoteResponse(
                note.getId(),
                note.getCategoryId(),
                note.getTitle(),
                note.getMarkdownContent(),
                note.getNoteStatus().name(),
                note.getHiddenAt(),
                note.getCreatedAt(),
                note.getUpdatedAt());
    }
}
