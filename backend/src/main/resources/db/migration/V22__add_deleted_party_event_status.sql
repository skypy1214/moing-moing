alter table party_events drop constraint chk_party_events_status;
alter table party_events add constraint chk_party_events_status
    check (event_status in ('DRAFT', 'OPEN', 'CLOSED', 'DELETED'));