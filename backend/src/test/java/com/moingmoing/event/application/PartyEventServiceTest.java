package com.moingmoing.event.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.moingmoing.auth.infrastructure.UserAccountRepository;
import com.moingmoing.event.domain.PartyEvent;
import com.moingmoing.event.domain.PartyEventStatus;
import com.moingmoing.event.infrastructure.PartyEventRepository;
import com.moingmoing.event.infrastructure.PartyRoleAssignmentRepository;
import com.moingmoing.event.infrastructure.PartyRoleRepository;

class PartyEventServiceTest {
    private final PartyEventRepository events = mock(PartyEventRepository.class);
    private final PartyEventService service = new PartyEventService(
            events,
            mock(PartyRoleRepository.class),
            mock(PartyRoleAssignmentRepository.class),
            mock(UserAccountRepository.class));

    @Test
    void includesDraftEventsInTheMemberList() {
        PartyEvent draftEvent = new PartyEvent("준비 중 이벤트", PartyEventStatus.DRAFT);
        when(events.findAllByEventStatusNotOrderByCreatedAtDesc(PartyEventStatus.DELETED))
                .thenReturn(List.of(draftEvent));

        List<PartyEventService.EventSummary> result = service.list(false);

        assertThat(result).singleElement().extracting(PartyEventService.EventSummary::eventStatus)
                .isEqualTo(PartyEventStatus.DRAFT);
    }
}
