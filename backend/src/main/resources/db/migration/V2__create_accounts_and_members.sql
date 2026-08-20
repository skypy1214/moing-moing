create table user_accounts (
    id uuid primary key,
    login_id varchar(80) not null unique,
    password_hash varchar(255) not null,
    account_status varchar(20) not null,
    last_login_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_user_accounts_status check (account_status in ('ACTIVE', 'DISABLED'))
);

create table user_account_roles (
    user_account_id uuid not null references user_accounts(id),
    role_code varchar(40) not null,
    primary key (user_account_id, role_code)
);

create table members (
    id uuid primary key,
    display_name varchar(100) not null,
    external_nickname varchar(100),
    membership_status varchar(20) not null,
    joined_on date not null,
    withdrawn_on date,
    memo varchar(1000),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_members_status check (
        (membership_status = 'ACTIVE' and withdrawn_on is null)
        or (membership_status = 'WITHDRAWN' and withdrawn_on is not null)
    )
);

create index idx_members_status_name on members (membership_status, display_name, id);

create table member_activity_exclusions (
    id uuid primary key,
    member_id uuid not null references members(id),
    reason varchar(40) not null,
    start_date date not null,
    end_date date,
    note varchar(1000),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_exclusion_dates check (end_date is null or end_date >= start_date)
);

create index idx_activity_exclusions_member_dates
    on member_activity_exclusions (member_id, start_date, end_date);
