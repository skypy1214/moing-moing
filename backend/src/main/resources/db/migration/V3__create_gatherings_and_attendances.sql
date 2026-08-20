create table gatherings (
    id uuid primary key,
    held_on date not null,
    title varchar(200),
    starts_at timestamptz,
    location varchar(200),
    gathering_status varchar(20) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_gatherings_status check (gathering_status in ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED'))
);

create index idx_gatherings_held_on on gatherings (held_on, id);

create table attendances (
    id uuid primary key,
    gathering_id uuid not null references gatherings(id),
    member_id uuid not null references members(id),
    participation_type varchar(20) not null,
    attendance_status varchar(20) not null,
    recorded_at timestamptz not null,
    cancelled_at timestamptz,
    cancellation_reason varchar(1000),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_attendances_gathering_member unique (gathering_id, member_id),
    constraint chk_attendances_participation_type check (participation_type in ('NORMAL', 'COUPON')),
    constraint chk_attendances_status check (
        (attendance_status = 'RECORDED' and cancelled_at is null and cancellation_reason is null)
        or (attendance_status = 'CANCELLED' and cancelled_at is not null and cancellation_reason is not null)
    )
);

create index idx_attendances_member_recorded on attendances (member_id, recorded_at desc);
create index idx_attendances_gathering_status on attendances (gathering_id, attendance_status);
