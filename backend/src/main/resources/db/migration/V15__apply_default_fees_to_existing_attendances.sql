alter table attendances
    add column fee_overridden boolean not null default false;

update attendances attendance
set applied_fee = gathering.default_participation_fee,
    payment_status = 'PENDING'
from gatherings gathering
where attendance.gathering_id = gathering.id
  and attendance.participation_type = 'NORMAL'
  and attendance.applied_fee = 0
  and attendance.payment_status = 'EXEMPT';
