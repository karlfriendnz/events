-- Platform-wide help articles (authored by super-admins at /admin/help).
-- Content is written with terminology TOKENS like {member}/{members}/{group}/
-- {groups}/{term}/{code}... which render per-club via the terminology engine.
-- Visibility on the club side: module must be enabled (organisations.enabled_modules)
-- AND the user's role must have read access to `resource` (usePermissions/useCan).
-- Structured (explanation + ordered steps) so a chatbot can consume it later.
create table if not exists help_articles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,              -- stable slug, e.g. 'term-setup-wizard'
  title text not null,                   -- may contain tokens
  explanation text not null default '',  -- the "what is this & why" (tokens allowed)
  steps jsonb not null default '[]',     -- [{ title, body }] ordered tutorial (tokens allowed)
  module text,                           -- useOrgModules MODULE_DEFS key (null = always)
  resource text,                         -- usePermissions PERMISSION_RESOURCES key for role gating (null = everyone)
  route text,                            -- related app route, e.g. '/groups/term-wizard'
  sort_order int not null default 0,
  status text not null default 'draft',  -- 'draft' | 'published'
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists help_articles_module_idx on help_articles(module);

-- ── Starter articles (idempotent) ───────────────────────────────────────────
-- Written with terminology tokens so every club sees its own words.
insert into help_articles (key, title, explanation, steps, module, resource, route, sort_order, status)
values
  (
    'term-setup-wizard',
    'Setting up your next {term}',
    'The {term} set-up wizard walks you through starting a new {term} end to end — creating the {term}, bringing over your {groups}, carrying or changing their fees, and turning on registration. It saves you rebuilding every {group} by hand each {term}, and keeps coaches, members and fees in place unless you decide otherwise.',
    '[
      {"title": "Open the wizard", "body": "From the {groups} area, choose \"Guided set-up\" (or use the roll-over nudge on your dashboard). The wizard opens on step 1, \"The {term}\"."},
      {"title": "Name the {term} and set its dates", "body": "Pick an existing future {term} or create one. Name, start and end dates are pre-suggested from your most recent {term}. Set when sign-ups open and close, then choose \"Save & continue\" — the {term} is saved immediately."},
      {"title": "Bring over your {groups}", "body": "On the {groups} step, tick the {groups} to carry into the new {term} and rename any if needed. Choose whether coaches and members come across or re-register."},
      {"title": "Create training sessions", "body": "On the trainings step, turn on automatic session creation to generate each {group}''s weekly trainings across the {term} window, so attendance is ready to take."},
      {"title": "Confirm fees per programme", "body": "The fees step walks through each {code} in turn. Review or edit each {group}''s fee options and line items, then confirm each programme."},
      {"title": "Finish and review", "body": "The summary shows exactly what will happen. Run it to create the {term}, roll over the {groups}, generate trainings and apply fees. You''ll get a done screen with the results."}
    ]'::jsonb,
    'groups', 'groups', '/groups/term-wizard', 10, 'published'
  ),
  (
    'classes-overview',
    'The {groups} board',
    'The {groups} board is your home for every {group} the club runs. {groups} are organised under {codes} (your programmes), so you can see them grouped, tabbed and summarised. From here you can open a {group}, jump to the week view timetable, or manage {codes}, fees, waitlists and roll-overs.',
    '[
      {"title": "Read the board", "body": "Each tab is a top-level {code}. Inside a tab, every {code} with {groups} is a section, and each row is one {group} with its head coach, member count, fees and sign-up status."},
      {"title": "Open a {group}", "body": "Click a {group}''s name to open its detail page — members, coaches, session times, fees and attendance."},
      {"title": "Switch to the week view", "body": "Use the \"Week view\" link to see every {group} laid out on a time-of-day by weekday timetable, colour-coded by {code}."},
      {"title": "Create {codes} and {groups}", "body": "Use \"New {code}\" to add a programme container and \"New {group}\" to add a {group} inside a {code}. A {group}''s {term} is inherited from its {code}."},
      {"title": "Filter by {term}", "body": "Use the {term} filter above the tabs to scope the board to one {term} — counts, fees and attendance all follow the filter."}
    ]'::jsonb,
    'groups', 'groups', '/groups', 20, 'published'
  ),
  (
    'group-fees',
    'Fees on a {group}',
    'Each {group} can offer one or more fee options — the different ways a member can pay to join. A fee option is made of line items (each with its own account code). A {group} with no fee is allowed: leaving a {group} free means members can join without paying. Fees carry over when you roll a {term}.',
    '[
      {"title": "See fees across {groups}", "body": "The fees overview lists every {group} and its fee options for the chosen {term}, so you can see at a glance which {groups} have fees and which are free."},
      {"title": "Add a fee to a {group}", "body": "Open a {group} and use its fees editor to add a fee option. Choose the type (upfront, recurring, instalment, concession or per-session) and add the line items that make it up."},
      {"title": "Add one fee to many {groups}", "body": "Use \"Add fee to {groups}\" to define a single fee option once and append it to several {groups} at the same time, without touching their existing options."},
      {"title": "Leave a {group} free", "body": "If a {group} shouldn''t charge, simply add no fee option — members can join for free. Note that a {group} needs at least one fee option to appear as \"live\" for public sign-up."}
    ]'::jsonb,
    'finances', 'fees', '/groups/fees', 30, 'published'
  ),
  (
    'waitlists',
    'How waitlists work',
    'A waitlist is a shared queue for equivalent {groups} — the same class offered on different days or times. Connect several {groups} to one waitlist so that when a spot opens in any of them, it fills from the single queue. At sign-up, a full {group} can offer an equivalent one that still has space.',
    '[
      {"title": "Create a waitlist", "body": "On the waitlists page, create a waitlist and give it a name. Set how it orders people — custom, first-in-first-served, or by priority."},
      {"title": "Connect equivalent {groups}", "body": "Add the {groups} that are interchangeable (e.g. Thursday 4pm and Friday 4pm) to the same waitlist. A {group} can belong to only one waitlist."},
      {"title": "Add people to the queue", "body": "Search for a person and add them to the waitlist. Each entry shows their age, how many {groups} they''re already in, and when they were added."},
      {"title": "Enrol from the waitlist", "body": "When a connected {group} has space, use \"Enrol\" on a waiting person to place them into that {group} — this adds their membership and removes the waitlist entry in one step."}
    ]'::jsonb,
    'groups', 'groups', '/groups/waitlists', 40, 'published'
  )
on conflict (key) do nothing;
