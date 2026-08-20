create table champion_reward_policies (
    id uuid primary key,
    version varchar(80) not null unique,
    effective_from date not null,
    active boolean not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_champion_reward_policy_effective_from unique (effective_from)
);

create table champion_reward_policy_tiers (
    id uuid primary key,
    policy_id uuid not null references champion_reward_policies(id),
    tie_count_from integer not null,
    tie_count_to integer,
    coupon_uses integer not null,
    constraint chk_champion_reward_tier_range check (
        tie_count_from > 0
        and (tie_count_to is null or tie_count_to >= tie_count_from)
    ),
    constraint chk_champion_reward_tier_coupon_uses check (coupon_uses > 0),
    constraint uq_champion_reward_policy_tier_start unique (policy_id, tie_count_from)
);

create table attendance_champion_awards (
    id uuid primary key,
    target_month date not null,
    member_id uuid not null references members(id),
    qualifying_attendance_count integer not null,
    rank integer not null,
    policy_version varchar(80) not null,
    reward_uses integer not null,
    award_status varchar(20) not null,
    calculated_at timestamptz not null,
    granted_at timestamptz,
    granted_by uuid references user_accounts(id),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint uq_attendance_champion_awards_month_member unique (target_month, member_id),
    constraint chk_attendance_champion_awards_month check (
        target_month = date_trunc('month', target_month)::date
    ),
    constraint chk_attendance_champion_awards_values check (
        qualifying_attendance_count >= 0 and rank > 0 and reward_uses > 0
    ),
    constraint chk_attendance_champion_awards_status check (
        award_status in ('CALCULATED', 'GRANTED', 'CANCELLED')
    )
);

create table coupons (
    id uuid primary key,
    member_id uuid not null references members(id),
    coupon_type varchar(40) not null,
    coupon_status varchar(20) not null,
    valid_from date not null,
    valid_until date not null,
    total_uses integer not null,
    remaining_uses integer not null,
    qr_token_hash varchar(255),
    issued_reason varchar(1000),
    issued_by uuid references user_accounts(id),
    issued_at timestamptz not null,
    suspended_at timestamptz,
    voided_at timestamptz,
    champion_award_id uuid references attendance_champion_awards(id),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_coupons_status check (
        coupon_status in ('ISSUED', 'SUSPENDED', 'EXPIRED', 'FULLY_USED', 'VOIDED')
    ),
    constraint chk_coupons_period check (valid_until >= valid_from),
    constraint chk_coupons_uses check (
        total_uses > 0 and remaining_uses >= 0 and remaining_uses <= total_uses
    ),
    constraint uq_coupons_qr_token_hash unique (qr_token_hash)
);

create index idx_coupons_member_status_until on coupons (member_id, coupon_status, valid_until);
create index idx_coupons_champion_award on coupons (champion_award_id);

create table coupon_usages (
    id uuid primary key,
    coupon_id uuid not null references coupons(id),
    attendance_id uuid not null unique references attendances(id),
    usage_status varchar(20) not null,
    used_at timestamptz not null,
    used_by uuid references user_accounts(id),
    reversed_at timestamptz,
    reversed_by uuid references user_accounts(id),
    reversal_reason varchar(1000),
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_coupon_usages_status check (usage_status in ('USED', 'REVERSED')),
    constraint chk_coupon_usages_reversal check (
        (usage_status = 'USED' and reversed_at is null and reversed_by is null and reversal_reason is null)
        or (usage_status = 'REVERSED' and reversed_at is not null and reversal_reason is not null)
    )
);

create index idx_coupon_usages_coupon_status on coupon_usages (coupon_id, usage_status, used_at desc);

-- The initial policy is data, not a Java constant: future changes add a version rather than rewriting history.
insert into champion_reward_policies (id, version, effective_from, active, created_at, updated_at)
values ('ad14bb45-77e4-48d1-86bb-5be347600001', 'champion-reward-v1', date '2000-01-01', true, now(), now());

insert into champion_reward_policy_tiers (id, policy_id, tie_count_from, tie_count_to, coupon_uses)
values
    ('ad14bb45-77e4-48d1-86bb-5be347600011', 'ad14bb45-77e4-48d1-86bb-5be347600001', 1, 2, 2),
    ('ad14bb45-77e4-48d1-86bb-5be347600012', 'ad14bb45-77e4-48d1-86bb-5be347600001', 3, null, 1);
