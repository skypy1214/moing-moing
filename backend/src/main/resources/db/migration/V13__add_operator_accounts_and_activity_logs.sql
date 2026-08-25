alter table user_accounts add column display_name varchar(100);
update user_accounts set display_name = login_id where display_name is null;
alter table user_accounts alter column display_name set not null;

create table activity_logs (
    id uuid primary key,
    actor_user_account_id uuid references user_accounts(id),
    actor_display_name varchar(100),
    action varchar(100) not null,
    target_type varchar(100),
    target_id varchar(100),
    request_id varchar(64),
    http_method varchar(10) not null,
    request_path varchar(500) not null,
    response_status integer not null,
    occurred_at timestamptz not null
);

create index idx_activity_logs_occurred_at on activity_logs (occurred_at desc, id desc);
create index idx_activity_logs_actor_occurred_at
    on activity_logs (actor_user_account_id, occurred_at desc, id desc);
