package com.moingmoing.event.api;

import com.moingmoing.event.application.PartyEventService;
import com.moingmoing.event.domain.PartyEvent;
import com.moingmoing.event.domain.PartyEventStatus;
import com.moingmoing.event.domain.PartyRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/events")
class PartyEventAdminController {
  private final PartyEventService service;

  PartyEventAdminController(PartyEventService service) {
    this.service = service;
  }

  @GetMapping
  List<PartyEventService.EventSummary> list() {
    return service.list(true);
  }

  @PostMapping
  ResponseEntity<PartyEventService.EventSummary> create(@Valid @RequestBody EventRequest request) {
    PartyEvent event = service.create(request.name(), request.eventStatus());
    return ResponseEntity.status(HttpStatus.CREATED).body(summary(event));
  }

  @PutMapping("/{eventId}")
  PartyEventService.EventSummary update(
      @PathVariable UUID eventId, @Valid @RequestBody EventRequest request) {
    return summary(service.update(eventId, request.name(), request.eventStatus()));
  }

  @DeleteMapping("/{eventId}")
  ResponseEntity<Void> delete(@PathVariable UUID eventId) {
    service.delete(eventId);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/{eventId}/roles")
  List<PartyEventService.RoleManagement> roles(@PathVariable UUID eventId) {
    return service.roles(eventId);
  }

  @PostMapping("/{eventId}/roles")
  PartyEventService.MyRole addRole(
      @PathVariable UUID eventId, @Valid @RequestBody RoleRequest request) {
    return response(
        service.addRole(eventId, request.name(), request.description(), request.mission()));
  }

  @PutMapping("/{eventId}/roles/{roleId}")
  PartyEventService.MyRole updateRole(
      @PathVariable UUID eventId,
      @PathVariable UUID roleId,
      @Valid @RequestBody RoleRequest request) {
    return response(
        service.updateRole(
            eventId, roleId, request.name(), request.description(), request.mission()));
  }

  @DeleteMapping("/{eventId}/roles/{roleId}/assignment")
  ResponseEntity<Void> unassignRole(@PathVariable UUID eventId, @PathVariable UUID roleId) {
    service.unassignRole(eventId, roleId);
    return ResponseEntity.noContent().build();
  }

  @DeleteMapping("/{eventId}/roles/{roleId}")
  ResponseEntity<Void> deleteRole(@PathVariable UUID eventId, @PathVariable UUID roleId) {
    service.deleteRole(eventId, roleId);
    return ResponseEntity.noContent().build();
  }

  private PartyEventService.EventSummary summary(PartyEvent event) {
    return new PartyEventService.EventSummary(
        event.getId(), event.getName(), event.getEventStatus());
  }

  private PartyEventService.MyRole response(PartyRole role) {
    return new PartyEventService.MyRole(
        role.getId(), role.getName(), role.getDescription(), role.getMission());
  }

  record EventRequest(
      @NotBlank @Size(max = 100) String name, @NotNull PartyEventStatus eventStatus) { }

  record RoleRequest(
      @NotBlank @Size(max = 100) String name,
      @NotBlank @Size(max = 3000) String description,
      @NotBlank @Size(max = 3000) String mission) { }
}
