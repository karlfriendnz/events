-- INVITE A CLUB TO AN EVENT (the NSO "Clubs" tab on the PZSelector).
--
-- A governing body composing an event needs to invite whole CLUBS from its
-- hierarchy, not just individual people. A club invitee is neither a person nor a
-- group, so it gets its own first-class join — keeping "this club is invited" as a
-- fact the event can show, report on, and later expand into per-person invitees,
-- rather than silently fanning a club out to member rows at invite time and losing
-- the club as an entity.
--
-- One row per (event, org). `org_id` is the invited CLUB; `invited_by_org_id` is the
-- governing body that added it (the event's org), kept for provenance so a
-- multi-body event can say who invited whom. `status` mirrors the invitees vocabulary
-- (INVITED / CONFIRMED / DECLINED / CANCELLED) so the two invitee kinds read the same.
--
-- Cascades on the event so deleting an event cleans up its club invitations; the
-- club org_id is a plain reference (a club leaving the platform is a governing-side
-- concern, not an event one).
create table if not exists event_org_invitees (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references events(id) on delete cascade,
  org_id             uuid not null references organisations(id) on delete cascade,
  invited_by_org_id  uuid references organisations(id) on delete set null,
  status             text not null default 'INVITED',
  invited_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (event_id, org_id)
);

create index if not exists event_org_invitees_event_idx on event_org_invitees(event_id);
create index if not exists event_org_invitees_org_idx on event_org_invitees(org_id);
