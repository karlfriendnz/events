-- Person-type TEMPLATES at master level (extension of the club-type defaults).
-- A club type's default_person_types already seeds a new club; this widens each
-- entry to carry the FULL starting config (permissions, menu_items, landing_path)
-- — jsonb, so no column change is needed. It also adds an "Overall default"
-- template that applies to EVERY new club, which each club type then extends.
alter table club_types add column if not exists is_overall_default boolean not null default false;

-- One overall-default template row (super-admin edits it at /admin/master).
insert into club_types (name, is_overall_default, sort_order)
select 'Overall default', true, -1
where not exists (select 1 from club_types where is_overall_default);

comment on column club_types.is_overall_default is
  'The platform-wide default person-type template applied to every new club (excluded from the club-assignment picker). Club types extend it.';
