insert into meeting_note_categories (id, name, color, sort_order, active, created_at, updated_at)
select '2f0b5e8a-23da-4b75-a9e0-0d238741d4b3', '회의록', '#6657D9', 0, true, now(), now()
where not exists (
    select 1 from meeting_note_categories where name = '회의록'
);

insert into meeting_note_categories (id, name, color, sort_order, active, created_at, updated_at)
select '18fe3a7b-5348-4f37-b2d5-37e5a95f4a50', '대관 일정', '#237A51', 1, true, now(), now()
where not exists (
    select 1 from meeting_note_categories where name = '대관 일정'
);
