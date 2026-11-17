package com.moingmoing.event.api;

import com.moingmoing.event.application.PartyEventService;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events")
class PartyEventController {
  private final PartyEventService service;

  PartyEventController(PartyEventService service) {
    this.service = service;
  }

  @GetMapping
  List<PartyEventService.EventSummary> list() {
    return service.list(false);
  }

  @GetMapping("/{eventId}")
  PartyEventService.Detail detail(@PathVariable UUID eventId, Authentication authentication) {
    boolean admin =
        authentication.getAuthorities().stream()
            .anyMatch(authority -> authority.getAuthority().equals("ROLE_ADMIN"));
    return service.detail(eventId, authentication.getName(), admin);
  }

  @PostMapping("/{eventId}/roles/{roleId}/claim")
  PartyEventService.MyRole claim(
      @PathVariable UUID eventId, @PathVariable UUID roleId, Authentication authentication) {
    return service.claim(eventId, roleId, authentication.getName());
  }
}
