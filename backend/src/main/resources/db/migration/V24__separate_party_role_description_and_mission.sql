alter table party_roles add column description text;
alter table party_roles add column mission text;

-- Preserve the previous role guidance in both new fields so no existing role loses its content.
update party_roles set description = duty, mission = duty;

alter table party_roles alter column description set not null;
alter table party_roles alter column mission set not null;
alter table party_roles drop column duty;