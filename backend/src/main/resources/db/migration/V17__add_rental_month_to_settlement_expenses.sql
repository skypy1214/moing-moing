alter table settlement_expenses
    add column rental_month date;

alter table settlement_expenses
    add constraint ck_settlement_expenses_rental_month_first_day
    check (rental_month is null or extract(day from rental_month) = 1);

create index ix_settlement_expenses_rental_month
    on settlement_expenses (rental_month desc, created_at desc)
    where rental_month is not null;
