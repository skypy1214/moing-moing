package com.moingmoing.event.application;

import com.moingmoing.auth.domain.UserAccount;
import com.moingmoing.auth.infrastructure.UserAccountRepository;
import com.moingmoing.event.domain.PartyEvent;
import com.moingmoing.event.domain.PartyEventStatus;
import com.moingmoing.event.domain.PartyRole;
import com.moingmoing.event.domain.PartyRoleAssignment;
import com.moingmoing.event.infrastructure.PartyEventRepository;
import com.moingmoing.event.infrastructure.PartyRoleAssignmentRepository;
import com.moingmoing.event.infrastructure.PartyRoleRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PartyEventService {
  private final PartyEventRepository events;
  private final PartyRoleRepository roles;
  private final PartyRoleAssignmentRepository assignments;
  private final UserAccountRepository accounts;

  public PartyEventService(
      PartyEventRepository events,
      PartyRoleRepository roles,
      PartyRoleAssignmentRepository assignments,
      UserAccountRepository accounts) {
    this.events = events;
    this.roles = roles;
    this.assignments = assignments;
    this.accounts = accounts;
  }

  @Transactional(readOnly = true)
  public List<EventSummary> list(boolean admin) {
    List<PartyEvent> result =
        events.findAllByEventStatusNotOrderByCreatedAtDesc(PartyEventStatus.DELETED);
    return result.stream().map(this::summary).toList();
  }

  public PartyEvent create(String name, PartyEventStatus status) {
    return events.save(new PartyEvent(name, status));
  }

  public PartyEvent update(UUID eventId, String name, PartyEventStatus status) {
    PartyEvent event = findEvent(eventId);
    event.update(name, status);
    return event;
  }

  public void delete(UUID eventId) {
    findEvent(eventId).delete();
  }

  public PartyRole addRole(UUID eventId, String name, String description, String mission) {
    findEvent(eventId);
    int nextOrder =
        roles
            .findTopByEventIdOrderByDisplayOrderDesc(eventId)
            .map(role -> role.getDisplayOrder() + 1)
            .orElse(1);
    return roles.save(new PartyRole(eventId, nextOrder, name, description, mission));
  }

  @Transactional(readOnly = true)
  public List<RoleManagement> roles(UUID eventId) {
    findEvent(eventId);
    Set<UUID> confirmedRoleIds =
        assignments.findAllByEventId(eventId).stream()
            .map(PartyRoleAssignment::getPartyRoleId)
            .collect(Collectors.toSet());
    return roles.findAllByEventIdOrderByDisplayOrderAsc(eventId).stream()
        .map(
            role ->
                new RoleManagement(
                    role.getId(),
                    role.getDisplayOrder(),
                    role.getName(),
                    role.getDescription(),
                    role.getMission(),
                    confirmedRoleIds.contains(role.getId())))
        .toList();
  }

  public PartyRole updateRole(
      UUID eventId, UUID roleId, String name, String description, String mission) {
    PartyRole role = findRole(eventId, roleId);
    if (assignments.existsByPartyRoleId(roleId)) {
      throw new IllegalStateException("이미 확정된 역할은 수정할 수 없습니다.");
    }
    role.update(name, description, mission);
    return role;
  }

  public void unassignRole(UUID eventId, UUID roleId) {
    findRole(eventId, roleId);
    if (assignments.deleteByEventIdAndPartyRoleId(eventId, roleId) == 0) {
      throw new IllegalStateException("확정된 역할이 아닙니다.");
    }
  }

  public void deleteRole(UUID eventId, UUID roleId) {
    PartyRole role = findRole(eventId, roleId);
    assignments.deleteByPartyRoleId(roleId);
    roles.delete(role);
  }

  @Transactional(readOnly = true)
  public Detail detail(UUID eventId, String login, boolean admin, boolean canViewMissions) {
    PartyEvent event = findEvent(eventId);
    UserAccount account = findAccount(login);
    List<PartyRole> eventRoles = roles.findAllByEventIdOrderByDisplayOrderAsc(eventId);
    Set<UUID> takenRoleIds =
        assignments.findAllByEventId(eventId).stream()
            .map(PartyRoleAssignment::getPartyRoleId)
            .collect(Collectors.toSet());
    PartyRoleAssignment ownAssignment =
        assignments.findByEventIdAndUserAccountId(eventId, account.getId()).orElse(null);
    MyRole myRole =
        ownAssignment == null
            ? null
            : eventRoles.stream()
                .filter(role -> role.getId().equals(ownAssignment.getPartyRoleId()))
                .findFirst()
                .map(
                    role ->
                        new MyRole(
                            role.getId(), role.getName(), role.getDescription(), role.getMission()))
                .orElse(null);

    List<Seat> seats =
        IntStream.range(0, eventRoles.size())
            .mapToObj(
                index -> {
                  PartyRole role = eventRoles.get(index);
                  return new Seat(
                      role.getId(),
                      index / 10 + 1,
                      (index % 10) / 2 + 1,
                      index % 2 + 1,
                      role.getName(),
                      role.getDescription(),
                      canViewMissions ? role.getMission() : null,
                      takenRoleIds.contains(role.getId()));
                })
            .toList();
    return new Detail(event.getId(), event.getName(), event.getEventStatus(), seats, myRole);
  }

  public MyRole claim(UUID eventId, UUID roleId, String login) {
    PartyEvent event = findEvent(eventId);
    if (event.getEventStatus() != PartyEventStatus.OPEN) {
      throw new IllegalStateException("현재 역할 선택을 진행할 수 없습니다.");
    }
    UserAccount account = findAccount(login);
    PartyRole role = findRole(eventId, roleId);
    if (assignments.findByEventIdAndUserAccountId(eventId, account.getId()).isPresent()) {
      throw new IllegalStateException("이미 역할을 확정했습니다.");
    }
    int inserted = assignments.claim(UUID.randomUUID(), eventId, roleId, account.getId());
    if (inserted == 0) {
      throw new IllegalStateException("방금 다른 참가자가 선택했습니다. 좌석표를 다시 확인해 주세요.");
    }
    return new MyRole(role.getId(), role.getName(), role.getDescription(), role.getMission());
  }

  private EventSummary summary(PartyEvent event) {
    return new EventSummary(event.getId(), event.getName(), event.getEventStatus());
  }

  private PartyEvent findEvent(UUID eventId) {
    return events
        .findById(eventId)
        .filter(event -> event.getEventStatus() != PartyEventStatus.DELETED)
        .orElseThrow(() -> new IllegalArgumentException("이벤트를 찾을 수 없습니다."));
  }

  private PartyRole findRole(UUID eventId, UUID roleId) {
    return roles
        .findByIdAndEventId(roleId, eventId)
        .orElseThrow(() -> new IllegalArgumentException("역할을 찾을 수 없습니다."));
  }

  private UserAccount findAccount(String login) {
    return accounts
        .findByLoginId(login)
        .orElseThrow(() -> new IllegalArgumentException("계정을 찾을 수 없습니다."));
  }

  public record EventSummary(UUID id, String name, PartyEventStatus eventStatus) { }

  public record Seat(
      UUID id,
      int section,
      int row,
      int column,
      String name,
      String description,
      String mission,
      boolean taken) { }

  public record MyRole(UUID id, String name, String description, String mission) { }

  public record RoleManagement(
      UUID id,
      int displayOrder,
      String name,
      String description,
      String mission,
      boolean confirmed) { }

  public record Detail(
      UUID id, String name, PartyEventStatus eventStatus, List<Seat> roles, MyRole myRole) { }
}
