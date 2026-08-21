alter table members
    add column member_role varchar(20) not null default 'MEMBER',
    add constraint chk_members_role check (member_role in ('MEMBER', 'STAFF', 'LEADER'));
