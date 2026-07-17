-- WIPE EVERY ORGANISATION + ALL ORG DATA — NO RESEED (17 Jul 2026, per Karl).
--
-- Why: we spent a day designing how a club's person type should connect to a
-- governing body's, and three explorations found the ground half-built — the
-- requirement person-type scope has no authoring UI (DisciplineWizard hardcodes
-- applies_to: []), an NSO owns zero person_target_types rows, and the group
-- page's "Open profile →" links to a field the profile refuses to render.
-- Rather than design on top of that from an armchair, Karl is setting a club up
-- from scratch through the real UI so the friction shows us what the model
-- should be. This clears the board for that.
--
-- Same wipe block as 236_reset_demo_gymnastics.sql, WITHOUT the reseed. Keeps:
--   • brands / club_types / sport_categories / help_articles — platform master
--     data, none of it org-scoped (club_types still carries the mig-255
--     is_overall_default template a new club is seeded from)
--   • permission_groups where org_id is null — the core templates every club
--     inherits (mig 154); only club-level overrides go
--   • everything in auth.* — the loop only walks `public`, so logins survive
--
-- Goes: 15 organisations, all 5 org_members rows, every person/class/event/
-- booking/form — including the gymnastics tree (236) and the racquets club (270).
--
-- Migrations run ONCE, so this does not re-trigger 270: the DB stays at zero,
-- which is the intent. On a full replay 236 → 270 → 271 still ends at zero.
--
-- Getting back in (traced before writing this, not assumed): a super-admin with
-- an empty organisations table logs in and lands on /admin in ONE redirect —
-- login.vue:140 routes super-admins there before any org lookup; org.global.ts:15
-- has an explicit super bypass that tolerates zero rows and contains no
-- navigateTo at all; onboarding.global.ts exempts /admin, super-admins AND a null
-- org, fail-open; layouts/admin.vue never reads orgId. Creating the first org
-- needs no pre-existing row (brand + club type optional, slug nullable,
-- applyClubTypeDefaults skipped-and-try/caught).
--
-- BEFORE YOUR FIRST LOGIN AFTER THIS: clear `fm_active_org` from sessionStorage
-- AND localStorage. The super-admin branch trusts the saved value without
-- validating it against the DB (unlike the non-super branch at org.global.ts:43),
-- so a stale pointer to a now-deleted org leaves /dashboard rendering blank-ish.
-- Harmless and self-healing on the first "Open →", but it reads as a bug.
do $$
declare
  r record;
begin
  -- Deletes run in arbitrary table order, so FK triggers must stand down.
  set local session_replication_role = replica;

  for r in select table_name from information_schema.tables
           where table_schema = 'public' and table_type = 'BASE TABLE' loop
    if r.table_name in ('brands', 'club_types', 'sport_categories', 'help_articles') then
      continue;
    elsif r.table_name = 'permission_groups' then
      delete from permission_groups where org_id is not null;
    else
      execute format('delete from %I', r.table_name);
    end if;
  end loop;

  raise notice '271: wiped every organisation. Master data + core permission templates + auth.users kept.';
end $$;
