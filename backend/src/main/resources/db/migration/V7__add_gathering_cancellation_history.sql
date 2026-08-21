alter table gatherings
    add column cancelled_at timestamptz,
    add column cancellation_reason varchar(1000);

update gatherings
set cancelled_at = updated_at,
    cancellation_reason = 'Legacy cancellation history (reason was not recorded)'
where gathering_status = 'CANCELLED';

alter table gatherings
    add constraint chk_gatherings_cancellation_details check (
        (gathering_status = 'CANCELLED' and cancelled_at is not null and cancellation_reason is not null)
        or (gathering_status <> 'CANCELLED' and cancelled_at is null and cancellation_reason is null)
    );

create index idx_gatherings_cancelled_at on gatherings (cancelled_at desc, id);
