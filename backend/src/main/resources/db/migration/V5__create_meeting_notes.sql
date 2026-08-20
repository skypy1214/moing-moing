create table meeting_note_categories (
    id uuid primary key,
    name varchar(100) not null unique,
    color varchar(20) not null,
    sort_order integer not null,
    active boolean not null,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_meeting_note_categories_sort_order check (sort_order >= 0)
);

create table meeting_notes (
    id uuid primary key,
    category_id uuid not null references meeting_note_categories(id),
    title varchar(200) not null,
    markdown_content text not null,
    note_status varchar(20) not null,
    hidden_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint chk_meeting_notes_status check (note_status in ('PUBLISHED', 'HIDDEN')),
    constraint chk_meeting_notes_hidden_at check (
        (note_status = 'PUBLISHED' and hidden_at is null)
        or (note_status = 'HIDDEN' and hidden_at is not null)
    )
);

create index idx_meeting_notes_category_status_created
    on meeting_notes (category_id, note_status, created_at desc);
