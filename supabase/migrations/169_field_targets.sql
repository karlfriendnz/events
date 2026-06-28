-- Shared custom fields across person types.
-- A field_definition can now apply to MANY person types, not just one.
-- targets[] is the new source of truth; the legacy single `target` (migration 142)
-- stays as a fallback for any unmigrated reader. A field applies to type K when K
-- is in targets (lower-cased), else falls back to [target].

alter table field_definitions add column if not exists targets text[] not null default '{}';

-- Backfill from the legacy single target (lower-cased) where not yet set.
update field_definitions
  set targets = array[lower(target)]
  where coalesce(array_length(targets, 1), 0) = 0;
