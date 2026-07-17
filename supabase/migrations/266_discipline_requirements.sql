-- ============================================================
-- 266_discipline_requirements.sql
-- Requirements live ON THE DISCIPLINE. A governing body says "to be part of this
-- discipline a person must have X recorded" (presence) or "must have X = Y"
-- (value). Nothing blocks a registration — unmet requirements surface as FLAGS
-- on the group roster and the dashboard.
--
-- SUPERSEDES the dormant field_definitions.rules column (migration 141), which
-- stays dead. 141 put the rule on the FIELD ("School is required when discipline
-- = Junior Football"); this puts it on the DISCIPLINE ("Junior Football requires
-- School"), so one query answers "what does this discipline demand?". Do not
-- build the other half of 141.
--
-- Age band: "a junior is anyone under 16" is a band ON THE DISCIPLINE, mirroring
-- events.age_min/age_max (264). INCLUSIVE both ends — "under 16" is age_max = 15.
-- The band SELECTS which child discipline a person falls into; it does NOT
-- restrict who may register (that's events.age_min/age_max). It does not inherit
-- down the chain: an inherited band would make every child an age-candidate
-- matching its parent's full range, so selection would be ambiguous for everyone.
--
-- No org_id: this is a child of disciplines, which is already org-scoped — the
-- same rule as member_group_disciplines / event_disciplines /
-- member_group_memberships. Scope via disciplines!inner(org_id). NB requirements
-- are authored by the NSO, so a club-side consumer reads them by discipline_id
-- and must never filter them by its own org.
-- ============================================================

alter table disciplines add column if not exists age_min integer;
alter table disciplines add column if not exists age_max integer;

alter table disciplines drop constraint if exists disciplines_age_band_order;
alter table disciplines add constraint disciplines_age_band_order
  check (age_min is null or age_max is null or age_min <= age_max);

create table if not exists discipline_requirements (
  id                  uuid primary key default gen_random_uuid(),
  discipline_id       uuid not null references disciplines(id) on delete cascade,

  -- The field under test. EXACTLY ONE of these is set (see the check below):
  --   field_column        → a persons column name ('dob', 'gender', …)
  --   field_definition_id → a field_definitions row (a custom field)
  -- Two columns rather than one text key so that deleting a field CASCADES its
  -- requirements away. A single text key could carry no FK, and the orphan would
  -- fail INVERTED and SILENTLY: "Is Not Empty" on a dead key resolves undefined
  -- → unmet → every member of every group on that discipline flagged forever,
  -- naming a field that no longer exists in the picker.
  --
  -- field_key re-joins the two into the ONE key usePersonFields' catalogue uses
  -- (core key = column name, custom key = field id), so the evaluator, the field
  -- picker and the closest-wins override all speak the same key.
  field_column        text,
  field_definition_id uuid references field_definitions(id) on delete cascade,
  field_key           text generated always as
                        (coalesce(field_definition_id::text, field_column)) stored,

  -- IDENTICAL vocabulary to visibility_conditions (FormFieldAdvancedEditor.vue
  -- operators, evaluated by FormRenderer.vue condPasses). If one list gains an
  -- operator, so does the other. Ignored when exempt.
  operator            text not null default 'Is Not Empty'
                        check (operator in ('Equals', 'Is Not', 'Contains', 'Is Empty', 'Is Not Empty')),
  value               jsonb,

  -- exempt = this row asserts NOTHING. It exists to CLAIM the field_key so it
  -- shadows an ancestor discipline's rows for that field (closest-wins). Shown
  -- in the UI as the "Not required" option in the operator dropdown.
  exempt              boolean not null default false,

  -- person_target_types.key[] — null/empty = defer to the FIELD's own targets[]
  -- (useOrgFieldPolicy.fieldAppliesTo). MUST be applied BEFORE closest-wins: a
  -- coach-scoped child row must not shadow a member-scoped parent row.
  applies_to          text[],

  message             text,   -- optional flag text; null = generated from the field + discipline
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),

  constraint discipline_requirements_one_field check (
    (field_column is not null and field_definition_id is null) or
    (field_column is null and field_definition_id is not null)
  )
);

create index if not exists discipline_requirements_discipline_idx on discipline_requirements(discipline_id);
create index if not exists discipline_requirements_field_def_idx on discipline_requirements(field_definition_id);
