-- A hidden SANDBOX club used only as the preview canvas when editing person-type
-- template dashboards at master. Never a real club; excluded from admin lists.
-- Seeded with a little demo data so template dashboards render something.
alter table organisations add column if not exists is_sandbox boolean not null default false;

do $$
declare v_org uuid; v_grp uuid; i int;
begin
  if exists (select 1 from organisations where is_sandbox) then return; end if;

  insert into organisations (name, slug, type, is_sandbox)
  values ('Template Sandbox', 'template-sandbox', 'CLUB', true)
  returning id into v_org;

  -- ~10 demo people
  for i in 1..10 loop
    insert into persons (org_id, first_name, last_name, email, person_type, person_types, membership_type)
    values (v_org, 'Sample', 'Member ' || i, 'sample'||i||'@sandbox.local', 'member', array['member'],
            (array['Full','Junior','Social'])[1 + (i % 3)]);
  end loop;

  -- one class with a few members
  insert into member_groups (org_id, name, color) values (v_org, 'Sample Class', '#2b50b3') returning id into v_grp;
  insert into member_group_memberships (group_id, person_id)
  select v_grp, id from persons where org_id = v_org limit 6;

  -- a couple of upcoming events
  insert into events (org_id, title, style, status, start_at, end_at)
  values
    (v_org, 'Sample Event', 'BASIC', 'PUBLISHED', now() + interval '3 days', now() + interval '3 days' + interval '2 hours'),
    (v_org, 'Sample Session', 'BASIC', 'PUBLISHED', now() + interval '10 days', now() + interval '10 days' + interval '1 hour');
end $$;
