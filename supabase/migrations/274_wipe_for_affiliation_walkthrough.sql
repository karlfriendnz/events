-- WIPE AGAIN — walk the affiliation handshake from scratch (17 Jul 2026, per Karl).
--
-- 271 wiped so Karl could set a club up by hand and show us where it was hard. It
-- worked: that walkthrough produced the person-type link (272) and then the
-- affiliation handshake (273), neither of which any amount of designing had
-- reached. Now the flow itself has changed shape — a club REQUESTS a body and the
-- body APPROVES — so the half-built Football / Mount Sports state is a poor place
-- to judge it from. Clear the board and walk the new flow end to end.
--
-- Identical to 271. Keeps brands / club_types / sport_categories / help_articles,
-- the core permission templates (org_id is null), and all of auth.* — the loop
-- only walks `public`, so logins survive.
--
-- Reminder before the first login after this: clear `fm_active_org` from
-- sessionStorage AND localStorage. The super-admin branch trusts the saved value
-- without validating it against the DB (org.global.ts:18 vs the non-super branch
-- at :43), so a stale pointer to a deleted org leaves /dashboard blank-ish. It
-- self-heals on the first "Open →", but it reads as a bug.
--
-- The route to walk this time:
--   /admin            → create the body, then the club (Club type optional — and
--                       note it no longer has to seed the person types, since
--                       affiliating does)
--   body  → Settings → People & Entities  → its Player type + a field
--   club  → Settings → Sports & locations → pick the body = REQUEST (watch the
--                       amber "their fields don't apply yet")
--   body  → Settings → Clubs             → Approve  (types arrive pre-linked)
--   club  → Settings → People & Entities → rename the type to anything; the link
--                       holds and the field stays
do $$
declare
  r record;
begin
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

  raise notice '274: wiped every organisation again. Walk: request -> approve -> types arrive pre-linked.';
end $$;
