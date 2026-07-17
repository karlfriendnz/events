-- CLUB PERSON TYPE ↔ GOVERNING-BODY PERSON TYPE (17 Jul 2026, per Karl).
--
-- The problem, found by setting a club up by hand: a club's person type reaches a
-- governing body's ONLY by spelling its key identically. Call them "Player" and
-- Football's fields arrive; call them "Players", "Footballer" or "Member" and
-- NOTHING arrives — no error, no hint, an empty Fields tab that looks exactly like
-- a working one. The label was carrying the meaning, so renaming was a silent
-- break. Karl, mid-walkthrough: "the player should be able to be called anything
-- so there needs to be a link of some sort."
--
-- MANY, not one. A club runs tennis + badminton + squash + pickleball under four
-- separate bodies, and one person plays all four. That is ONE club "Player" type
-- with FOUR claims on it — not four types, which would make one human hold four
-- person types to play four sports at one club.
--
-- A LINK, not a copy. Field inheritance is already a live read-time join
-- (useOrgFieldPolicy.resolveFields), so a body adding a field flows down on the
-- next load with nothing to sync. This table only says WHICH of the body's types
-- our type answers to; it never duplicates the body's data.
--
-- Cascades both ways on purpose: the body deletes its Player → the link dies (no
-- dangling uuid quietly widening a chain forever); the club deletes its type →
-- the link dies with it.
create table if not exists person_type_links (
  id              uuid primary key default gen_random_uuid(),

  -- The CLUB. Denormalised from type_id's owner purely so the common query
  -- ("every link my club has") is one indexed filter and not a join.
  org_id          uuid not null references organisations(id) on delete cascade,

  -- Our type — the one the club named whatever it liked.
  type_id         uuid not null references person_target_types(id) on delete cascade,

  -- The governing body's type we answer to. MUST be owned by an org in this
  -- club's governing chain (org_ancestors ∪ org_sport_ancestors). Not enforceable
  -- by a CHECK — the chain is a recursive walk — so useOrgFieldPolicy only ever
  -- offers reachable types, and resolution ignores an unreachable link rather
  -- than trusting it.
  source_type_id  uuid not null references person_target_types(id) on delete cascade,

  created_at      timestamptz not null default now(),

  -- One claim per body per type. Re-linking the same pair is a no-op, which keeps
  -- the connect-a-sport reconciliation idempotent.
  unique (type_id, source_type_id),

  -- A type cannot answer to itself.
  constraint person_type_links_no_self check (type_id <> source_type_id)
);

create index if not exists person_type_links_org_idx on person_type_links(org_id);
create index if not exists person_type_links_type_idx on person_type_links(type_id);
create index if not exists person_type_links_source_idx on person_type_links(source_type_id);

comment on table person_type_links is
  'Club person type → governing-body person type. Many per type (a club may be affiliated to several bodies who each call them Player). Makes the club''s LABEL free: resolution walks the linked bodies'' keys, not the club''s spelling.';
