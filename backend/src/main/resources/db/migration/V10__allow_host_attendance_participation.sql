alter table attendances drop constraint chk_attendances_participation_type;

alter table attendances
    add constraint chk_attendances_participation_type
    check (participation_type in ('NORMAL', 'COUPON', 'HOST'));
