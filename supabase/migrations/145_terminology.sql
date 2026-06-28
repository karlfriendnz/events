-- Club-level terminology overrides (ported from the legacy Settings → Terminology).
-- A map of canonical term keys → { singular, plural } the club uses instead of the
-- defaults (e.g. "Member" → "Swimmer", "Group" → "Squad"). Resolved org + inherited
-- from governing bodies (NSO) the same way the field engine resolves fields, so an
-- NSO can set house terminology that flows down to its clubs.
alter table organisations
  add column if not exists terminology jsonb not null default '{}'::jsonb;

comment on column organisations.terminology is
  'Per-org terminology overrides: { "<key>": { "singular": "...", "plural": "..." } }. Resolved own + ancestor (NSO) with own winning.';
