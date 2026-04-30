# Events form migration — plan

## Status

**Done:**
- **Phase 1** — drag handles + Sortable wired into the events form's scratch-mode field canvas. Visual parity with the bookings form's `<FormFieldCanvas>`.
- **Phase 2** — section card list extracted to `<FormSectionList>`, used by both `<FormBuilder>` and the events form. Pure code dedup.

**Queued:** Phases 3–5 below.

## Phase 3 — Settings panel

**Decision: extract `<EventFormDesignPanel>` as its own component** (not unify with `<FormBuilder>`'s Settings).

Rationale: events Settings is a *design editor* — audience pills (Members / Public / Everyone), header image source toggle, info-icon checkbox grid, custom description toggle, page background picker (image upload + fade overlay), sponsors toggle, add-person button colour. `<FormBuilder>` Settings is three inputs (heading / submit / confirm). They aren't the same thing semantically. Forcing them into one component via slots makes both worse.

Concrete steps:
1. Create `components/EventFormDesignPanel.vue` containing the design panel UI (`pages/events/[id].vue` lines ~351–499, the `evtSelectedFormSection === 'design'` block).
2. Component takes `v-model="currentEvtFormDesign"` plus an audience binding for the active form group.
3. Replace the events form's design block with `<EventFormDesignPanel>`. Pure code extraction — no behaviour change.

Estimated: 1 session.

## Phase 4 — Field editor + preview

### 4a. Field editor — extract `<FormFieldEditor>`

The field editor (Details + Advanced tabs) is now duplicated. `<FormBuilder>` and the events form have visibility-conditions + financial-rules editors that are functionally identical.

1. Extract `<FormFieldEditor v-model:field>` from `<FormBuilder>`.
2. Replace the events form's editor block with `<FormFieldEditor>`.
3. Both consumers pass their own `conditionFieldOptions` / `accountCodes` arrays.

Estimated: 1 session.

### 4b. Preview — break into focused sub-components

The events preview (`pages/events/[id].vue` lines ~1232–2300) is a page-sized chunk. Break it down:

1. `<FormPreviewBanner>` — gradient or image header + event title overlay.
2. `<FormPreviewInfoIcons>` — Date / Time / Cost / Location / Restrictions row (driven by `currentEvtFormDesign.icons`).
3. `<FormPreviewPerson>` — single-person accordion: header (name + running total), body (form fields rendered + sessions + booking summary), remove-person button.
4. `<FormPreviewSessions>` — 3 layouts: list, date-table, group-picker.
5. `<FormPreviewPayment>` — 4 payment-option cards + payment plan calculator (when plan is enabled).
6. Wire them into the events form preview AND the standalone form builder's preview (the standalone version skips Sessions and Tickets, just renders the rest).

Estimated: 2–3 sessions.

## Phase 5 — Data unification

**Decision: add an `event_form_groups` join table** (option 1 from the earlier discussion).

Rationale: events have multi-audience semantics (Members / Public / Everyone) that the existing UX relies on. Walking it back is a regression. Stuffing the structure into a `registration_forms.config.audiences` jsonb (option 3) loses the SQL queryability — e.g. "how many forms target members" needs a SQL query, not a jsonb walk.

Schema (proposed migration `100_event_form_groups.sql`):

```sql
create table if not exists event_form_groups (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  form_id     uuid not null references registration_forms(id) on delete cascade,
  audience    text not null default 'all'
              check (audience in ('all', 'members', 'public')),
  name        text,
  sort_order  int not null default 0,
  -- Holds the design panel state (icons, header, description, etc.) per group.
  config      jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index event_form_groups_event_id_idx on event_form_groups(event_id, sort_order);
create index event_form_groups_form_id_idx  on event_form_groups(form_id);
```

Backfill:
- For every `events.form_id`, create one `event_form_groups` row with `audience='all'` and a placeholder name.
- `events.form_id` stays as-is (it's still used by the booking wizard for org-default fallback). Drop it later if we feel like it.

Code changes:
1. Events form save: writes to `registration_forms`, `form_fields`, `event_form_groups` per group instead of `evtFormGroupFields` in-memory.
2. Events form load: reads from those tables.
3. Audience pills bind to `event_form_groups.audience`.
4. Each group's design state lives in `event_form_groups.config` (no longer `currentEvtFormDesign` keyed by group id in memory).

Estimated: 2 sessions (1 for migration + save/load, 1 for validation pass).

## Order of execution

3 → 4a → 4b → 5. Each phase shippable on its own and leaves the events feature working at every step. Don't try to combine.

## What this unlocks

After Phase 5, both `<FormBuilder>` (modes) and the events form share:
- Same field canvas (`<FormFieldCanvas>`)
- Same section list (`<FormSectionList>`)
- Same field editor (`<FormFieldEditor>`)
- Same preview building blocks (`<FormPreviewBanner>` etc., events form composes more of them)
- Same persistence (`registration_forms` + `form_fields`)

…with events form keeping its event-specific extras (`<EventFormDesignPanel>`, `<FormPreviewSessions>`, ticket picker, multi-person accordions, payment plan calculator) as siblings, not as forced unification.
