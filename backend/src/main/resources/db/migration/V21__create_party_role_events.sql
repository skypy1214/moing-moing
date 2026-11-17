create table party_events (
    id uuid primary key,
    name varchar(100) not null,
    event_status varchar(20) not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_party_events_status check (event_status in ('DRAFT', 'OPEN', 'CLOSED'))
);

create table party_roles (
    id uuid primary key,
    event_id uuid not null references party_events(id),
    seat_row integer not null,
    seat_column integer not null,
    name varchar(100) not null,
    duty text not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_party_roles_seat unique (event_id, seat_row, seat_column),
    constraint uq_party_roles_id_event unique (id, event_id),
    constraint chk_party_roles_seat check (seat_row > 0 and seat_column > 0)
);

create table party_role_assignments (
    id uuid primary key,
    event_id uuid not null,
    party_role_id uuid not null,
    user_account_id uuid not null references user_accounts(id),
    confirmed_at timestamptz not null,
    constraint uq_party_role_assignments_role unique (party_role_id),
    constraint uq_party_role_assignments_event_account unique (event_id, user_account_id),
    constraint fk_party_role_assignments_role_event
        foreign key (party_role_id, event_id) references party_roles(id, event_id)
);

create index idx_party_roles_event_id on party_roles(event_id);
create index idx_party_role_assignments_event_id on party_role_assignments(event_id);