alter table gatherings
    add column gathering_type varchar(20) not null default 'CLASS',
    add column ends_on date;

alter table gatherings
    add constraint chk_gatherings_type_and_period check (
        (gathering_type = 'CLASS' and ends_on is null)
        or (gathering_type = 'EVENT' and ends_on is not null and ends_on >= held_on)
    );

alter table gatherings
    add constraint chk_gatherings_type check (gathering_type in ('CLASS', 'EVENT'));
