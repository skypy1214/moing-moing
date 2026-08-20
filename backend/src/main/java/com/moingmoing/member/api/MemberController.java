package com.moingmoing.member.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.moingmoing.member.application.MemberService;

@RestController
@RequestMapping("/api/v1/members")
class MemberController {
    private final MemberService memberService;

    MemberController(MemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping
    List<MemberResponse> list() {
        return memberService.findAll().stream().map(MemberResponse::from).toList();
    }

    @GetMapping("/{id}")
    MemberResponse get(@PathVariable UUID id) {
        return MemberResponse.from(memberService.findById(id));
    }

    @PostMapping
    ResponseEntity<MemberResponse> create(@Valid @RequestBody CreateMemberRequest request) {
        MemberResponse response = MemberResponse.from(memberService.create(
                request.displayName(), request.externalNickname(), request.joinedOn(), request.memo()));
        return ResponseEntity.created(URI.create("/api/v1/members/" + response.id())).body(response);
    }

    @PutMapping("/{id}")
    MemberResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateMemberRequest request) {
        return MemberResponse.from(memberService.update(
                id, request.displayName(), request.externalNickname(), request.joinedOn(), request.memo()));
    }

    @PostMapping("/{id}/withdraw")
    MemberResponse withdraw(@PathVariable UUID id, @Valid @RequestBody ChangeMembershipDateRequest request) {
        return MemberResponse.from(memberService.withdraw(id, request.date()));
    }

    @PostMapping("/{id}/reactivate")
    MemberResponse reactivate(@PathVariable UUID id, @Valid @RequestBody ChangeMembershipDateRequest request) {
        return MemberResponse.from(memberService.reactivate(id, request.date()));
    }

    @GetMapping("/{id}/activity-exclusions")
    List<ActivityExclusionResponse> listExclusions(@PathVariable UUID id) {
        return memberService.findExclusions(id).stream().map(ActivityExclusionResponse::from).toList();
    }

    @PostMapping("/{id}/activity-exclusions")
    ResponseEntity<ActivityExclusionResponse> startExclusion(
            @PathVariable UUID id, @Valid @RequestBody StartActivityExclusionRequest request) {
        ActivityExclusionResponse response = ActivityExclusionResponse.from(memberService.startExclusion(
                id, request.reason(), request.startDate(), request.note()));
        return ResponseEntity.created(URI.create("/api/v1/members/" + id + "/activity-exclusions/" + response.id()))
                .body(response);
    }

    @PostMapping("/{id}/activity-exclusions/{exclusionId}/end")
    ActivityExclusionResponse endExclusion(
            @PathVariable UUID id,
            @PathVariable UUID exclusionId,
            @Valid @RequestBody EndActivityExclusionRequest request) {
        return ActivityExclusionResponse.from(memberService.endExclusion(id, exclusionId, request.endDate()));
    }

    @PutMapping("/{id}/activity-exclusions/{exclusionId}")
    ActivityExclusionResponse updateExclusion(
            @PathVariable UUID id,
            @PathVariable UUID exclusionId,
            @Valid @RequestBody UpdateActivityExclusionRequest request) {
        return ActivityExclusionResponse.from(memberService.updateExclusion(
                id,
                exclusionId,
                request.reason(),
                request.startDate(),
                request.endDate(),
                request.note()));
    }
}
