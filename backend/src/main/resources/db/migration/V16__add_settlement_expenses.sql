create table settlement_expenses (
    id uuid primary key,
    spent_on date not null,
    category varchar(100) not null,
    description varchar(200),
    amount integer not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_settlement_expenses_amount_positive check (amount > 0)
);

create index ix_settlement_expenses_spent_on on settlement_expenses (spent_on desc, created_at desc);
