alter table gatherings
    add column default_participation_fee integer not null default 0,
    add constraint ck_gatherings_default_participation_fee_nonnegative
        check (default_participation_fee >= 0);

alter table attendances
    add column applied_fee integer not null default 0,
    add column payment_status varchar(20) not null default 'EXEMPT',
    add column paid_at timestamp with time zone,
    add constraint ck_attendances_applied_fee_nonnegative check (applied_fee >= 0),
    add constraint ck_attendances_payment_status
        check (payment_status in ('PENDING', 'PAID', 'EXEMPT'));
