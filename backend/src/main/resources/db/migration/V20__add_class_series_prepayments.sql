create table class_series (
    id uuid primary key,
    title varchar(200) not null,
    starts_on date not null,
    session_count integer not null,
    session_fee integer not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint ck_class_series_session_count check (session_count between 2 and 24),
    constraint ck_class_series_session_fee check (session_fee >= 0)
);

alter table gatherings add column class_series_id uuid;
alter table gatherings add constraint fk_gatherings_class_series
    foreign key (class_series_id) references class_series(id);
create index ix_gatherings_class_series_id on gatherings (class_series_id) where class_series_id is not null;

create table class_series_enrollments (
    id uuid primary key,
    class_series_id uuid not null references class_series(id),
    member_id uuid not null references members(id),
    paid_amount integer not null,
    paid_on date not null,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null,
    constraint uq_class_series_enrollment_member unique (class_series_id, member_id),
    constraint ck_class_series_enrollment_paid_amount check (paid_amount >= 0)
);

create index ix_class_series_enrollments_paid_on on class_series_enrollments (paid_on desc);
