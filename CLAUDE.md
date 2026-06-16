# FriendlyManager Events — Codebase Guide

---

## URL → File Lookup

Given any URL, find the file and what to expect instantly.

| URL pattern | File | Lines | Notes |
|---|---|---|---|
| `/` | `pages/index.vue` | 4 | Redirects to `/events` |
| `/login` | `pages/login.vue` | 126 | Auth page, uses `useSupabaseClient()` directly |
| `/events` | `pages/events/index.vue` | 1059 | Event list with search, filters, calendar toggle |
| `/events/new` | `pages/events/new.vue` | 27 | Redirect stub → `/events/new-basic` |
| `/events/new-basic` | `pages/events/new-basic.vue` | ~870 | Single-event creation wizard. Includes a **"Public registration form"** toggle below Visibility — when ON it renders the same `<FormBuilder>` the advanced event uses (default fields: First/Last name, Email, Phone, People Attending, Notes); on save the form is persisted to `registration_forms` + `form_fields` (mirroring `/forms/[id].vue`'s save shape) and linked via `events.form_id`. The form name defaults to the event title. |
| `/events/new-advanced` | `pages/events/new-advanced.vue` | 742 | Advanced event form; Sessions step uses `<BulkSessionTemplates>` to generate sessions across programme days |
| `/events/new-multi` | `pages/events/new-multi.vue` | 285 | Bulk event creation from templates |
| `/events/reporting` | `pages/events/reporting.vue` | 292 | Event analytics/reporting |
| `/events/:id` | `pages/events/[id].vue` | **~8230** | **Main event editor** — see tab breakdown below |
| `/bookables` | `pages/bookables/index.vue` | ~90 | **Unified page** with centered pill tabs — renders `<BookingsList>`, `<BookablesList>`, `<ActivitiesList>`, `<BookingDiscountsList>`, or `<AccessControlList>`. Bookings tab hidden when no active bookables exist. `<BookablesList>` itself has inner Venues/Persons/Items/**Archived** sub-tabs (Archived only shown when count > 0). Venues view groups each top-level facility into its own card, with depth-0 expanded by default and any nested venue collapsed |
| `/bookables/new-v2` | `pages/bookables/new-v2.vue` | ~660 | **Complete club setup wizard** — the conversational alternative to v1. Five stages: **0 Club name** (only when org has zero top-level venues) → **1 Capture areas** (chip-style multi-input: "What sort of areas do you want to hire out?" — user types each area in singular, e.g. *Tennis Court, Locker, Function Room*) → **2 Per-area config loop** (for each captured area, in turn: "How many *Tennis Court*s do you have?" + concurrent capacity + "What sort of *Tennis Court* bookings do you offer?" via mode chips; "Save & set up *Locker*" advances to the next area; "Save & continue" on the last area moves to stage 3) → **3 Availability** (shared across every area created) → **4 Photo** (lives on the club row, sub-venues inherit) → **5 Summary + Create**. State: `form.areas: Area[]` where each area becomes one activity + N venue siblings (`is_master`/`master_id`) + N availability rules; `revealedUpTo` is the outer stage counter, `stage2Index` walks through areas inside stage 2. When 1 top-level venue already exists, the wizard skips club setup and auto-defaults `form.parent_id` to it. Pressing Enter advances + focuses the next input. Captured modes attach to a per-area activity at submit; if no modes captured for an area, a "Default" mode is seeded so the venue is bookable end-to-end. v1 has a "Try v2 →" link; v2 has a "← Try v1" link |
| `/bookables/new` | `pages/bookables/new.vue` | ~700 | 4-step Create Venue wizard: **Details** (name, parent, location, **number of venues** siblings to create at once, max capacity, description, **image upload**) → **Activities** (pick existing or add inline; for each new activity, "+ Add mode" opens `<ModeWizard>` so the user can capture full mode details — name, capacity, pricing — and chain multiple via "Save & add another"; activities step is optional) → **Availability** (Always 24/7 or scheduled days/hours) → **Review**. Submit creates one master + N linked siblings (`is_master`/`master_id`), persists each new activity's captured modes (or seeds a single "Default" mode if none were captured), writes one `availability_rules` row per sibling (always written; ALWAYS = 00:00–23:59 across every day), sets `is_public: true` to match other wizards. The "Add Sub-venue" / "Add Item" buttons on `/bookables/:id` use `createChildBookable()` (insert + redirect to `/bookables/:id?new=1`); only the top-level "New Venue" button comes through the wizard |
| `/bookables/:id` | `pages/bookables/[id].vue` | ~2160 | Venue detail — wraps `<BookableEditor>` in tabs + Sub-venues tab with venue map and Configurations panel + **Access tab** (`<BookableAccessEditor>` — connect doors and lights, set code delivery and unlock timing) |
| `/bookings/new` | `pages/bookings/new.vue` | ~220 | Activity-first picker — mirrors `/book`. Home = each non-coach activity as its own card + a single aggregate **Coaching** card if any coach activities exist. Click an activity → straight into its flow. Click Coaching → drill-down with **Services / Coaches** toggle (Services = coach modes grouped by category; Coaches = list of coach activities). Picking a mode preselects activity + mode on the wizard. Dispatches to `<BookingScheduler>` / `<ItemBooker>` / `<BookingWizard>` (staff). **Auto-select**: when the org has exactly one activity, the picker is skipped — the page lands straight in that activity's booking flow |
| `/book` | `pages/book/index.vue` | ~270 | Same picker shape as `/bookings/new` (activity cards + Coaching aggregator → drill-down with Services/Coaches toggle), public-facing — reads `?org=`, themed via `organisations.booker_theme`. **Auto-select**: when the org has exactly one activity, the picker is skipped (treated as a deep-link so the inner view's back-to-picker button stays hidden) |
| `/dev/seed-items` | `pages/dev/seed-items.vue` | ~390 | One-click full-club demo seeder. Every entity name is prefixed `[Demo]` so it's easy to spot + safe to clear. Creates: equipment inventory (Bowling Machine ×2, Footballs ×20, Cones ×50), 3 cricket nets, 3 tennis courts, 10 lockers, projector, two coaches ([Demo] Sarah Wright = cricket with required net + bowling-machine modes; [Demo] Tom Singh = tennis), [Demo] Tennis Court Hire venue activity. Modes tagged with categories (Cricket / Tennis / Equipment hire / Storage) so the booker's "By service" cards work end-to-end. **Also sets the org-level `season_start`/`season_end` defaults** to (today − 14 days) and (today + 4 months) so demo data lives inside a sensible season window. Also includes a **Clear demo data** button — deletes anything in the org whose name starts with `[Demo]`. Cascades cover modes, resources, required_items, activity_bookables |
| `/activities/:id` | `pages/activities/[id]/index.vue` | ~720 | Activity detail — Details card (incl. image upload at bottom), modes list, back button to `/bookables?tab=activities` |
| `/activities/:id/modes/new` | `pages/activities/[id]/modes/[modeId].vue` | ~950 | New mode (modeId === 'new') |
| `/activities/:id/modes/:modeId` | `pages/activities/[id]/modes/[modeId].vue` | ~950 | Edit existing mode. Three tabs: **Details** (single card, sections: Identity → Capacity → What's bundled), **Pricing** (single card: Rates → Add-ons → Payment), **Bookings** (single card: Approval → Booking form → Wizard calendar). Details tab also has an "Advanced" disclosure below the main card holding the legacy Bookable scope + Required configuration controls (hidden entirely for staff-owned activities). Hero header carries name + status chips + Save/Delete |
| `/settings` | `pages/settings/index.vue` | ~1275 | Org settings — members, billing, fields, etc. General tab "Organisation" card holds Name / **National org** (filterable Select of every `organisations` row where `type='NSO'`, persists to `organisations.parent_id`) / Currency / Locale / **Season** date-range (`organisations.season_start` + `organisations.season_end`, used as the default scope for group terms, attendance, and reporting windows) |
| `/settings/calendars` | `pages/settings/calendars.vue` | 356 | Calendar integrations |
| `/settings/venues` | `pages/settings/venues.vue` | 148 | Venue tree editor (uses `<BookableEditor>`) |
| `/finances` | `pages/finances/index.vue` | 402 | Financial reporting |
| `/reporting` | `pages/reporting/index.vue` | 255 | General reporting |
| `/attendance` | `pages/attendance/index.vue` | ~150 | Attendance landing — surfaces every group-linked event occurrence in the next 15 days (today + 14 upcoming). Filter is `member_group_id IS NOT NULL` rather than event style (training events are created as `style='BASIC'` so they show up in the normal events list too). Each event row IS one occurrence (master = first occurrence, child events via `recurrence_parent_id` = subsequent weeks), so the page just queries events in the time window without joining sessions. **Today** section lists each occurrence with group name + color dot + time + location + a primary "Take attendance" button that deep-links to `/events/:eventId?tab=attendance`. **Upcoming** section groups the next two weeks by date with a lighter "Open" link per row. Empty state guides the user to `/groups` to create training events. Sidebar entry icon `pi-check-square`, sits between Registration and Groups in `layouts/default.vue` `navItems` |
| `/groups` | `pages/groups/index.vue` | ~50 | Groups landing — `<AppCard title="Member Groups">` with a row per `member_groups` entry: color dot + name + member count (right-aligned, derived from `member_group_memberships`) + chevron. Each row is a `<NuxtLink>` to `/groups/:id`. Loads all rows for the current org, ordered by `sort_order` then `name`. Sidebar entry icon `pi-users`, sits between Attendance and Finances in `layouts/default.vue` `navItems` |
| `/groups/:id` | `pages/groups/[id].vue` | ~360 | Group detail — Trello-style two-column layout. Top bar: back link, color-dot + group name, right-aligned **"N training events linked"** count + **Create training events** button. Each `member_group_schedules` row maps to **one repeating event series** following the codebase's canonical master + child pattern: a master `events` row (style `BASIC`, `recurrence_rule='FREQ=WEEKLY;BYDAY=<day>;UNTIL=<seasonEnd>'`, location set directly on the event from the schedule's `LocationEntry`) plus one **child** `events` row per subsequent weekly occurrence (`recurrence_parent_id=master.id`, cloned location, individual start_at/end_at). `events.member_group_schedule_id` (migration 133) lives **only on the master** so "1 schedule = 1 master" stays clean; `events.member_group_id` is set on every event (master + children) so cross-training reporting aggregates naturally and the attendance landing can filter by group linkage rather than event style. Title pattern: `"{group.name} — {DayName} Training"`. **No `sessions` rows involved** — each event row IS one occurrence, which means attendance is event-level and the existing recurrence machinery (`/events/:id` "Generate Series" UI, `recurrence_parent_id`) is reused. **Group members are auto-invited**: after the series is materialised, every member of the group is inserted as an `invitees` row on every event in the series (master + children) with `status='INVITED'`, so the attendance tab on each occurrence opens with the roster already populated. Button is **idempotent** — only creates events for schedule rows that don't already have one (label switches to "Create N missing training events"); when all are linked the button hides. Disabled with helper text when schedules or season are missing ("Add session times first" / "Set the season in Settings → General"). Each schedule row in the Session Times panel gets an inline **Open →** link to its master event. Schedule editor save uses **stable IDs** (update-in-place + targeted deletes) so master events stay linked when the user edits the time/location of a row. Left column: **INFO** card (blue header, label/value grid for Code / Head / Age Range / Members count / Current Term / Term Fee + **Session Times** with inline **Edit** link — rows read from `member_group_schedules`, formatted `"Mon 3:00 PM – 5:00 PM · <location summary>"`; Edit opens a Dialog containing a **table** (Day / Start / End / Location / ×) — Location cell is a button showing the current summary that opens a **nested Dialog** holding the shared `<LocationEditor :multi="false">` (Address / Venue / Online tabs + multi-venue tree); Done applies, Cancel discards. Outer Save = delete-all-then-insert against `member_group_schedules` scoped to the group. Location is stored as a `LocationEntry` jsonb so future extensions to `<LocationEditor>` flow through automatically). **COACHES** card (blue header with envelope icon, 2-col coach tiles — first tile highlighted blue). Right column: **MEMBERS** card (blue header with envelope icon, full-width table: Name (blue link) / Phone / Email / row-end remove button that deletes from `member_group_memberships`). Real data wired: members, attendance-event link, **weekly training schedules**. Placeholders shown (`—`) for fields with no schema yet (code, age range, current term, term fee, capacity, head coach) |
| `/registration` | `pages/registration/index.vue` | 240 | Registration management |
| `/forms` | `pages/forms/index.vue` | ~80 | Forms list — shows all `registration_forms` with field counts and usage |
| `/forms/new` and `/forms/:id` | `pages/forms/[id].vue` | ~150 | **Thin wrapper** around `<FormBuilder>`; persists to `registration_forms` (config jsonb) + `form_fields`; round-trips via `?return=...&form_id=...` |

---

## Tab Breakdown — Frequently Edited Pages

### `/events/:id` → `pages/events/[id].vue`
The largest file (8326 lines). Each tab is a major section:

| Tab key | What it shows | Key components |
|---|---|---|
| `overview` | Summary card, quick stats | `<EventDetailsCard>` |
| `sessions` | Session list + inline editor | `<SessionEditor>`, `<BulkSessionTemplates>` |
| `invitees` | Invite groups/individuals | `<EventInviteeManager>`, `<InviteeGroupPicker>` |
| `forms` | Registration form builder | `<ConditionEditor>` |
| `discounts` | Discount codes | inline |
| `tickets` | Ticket types | inline |
| `communication` | Emails/notifications | inline |
| `automation` | Automation rules | inline |
| `reporting` | Event analytics — total registrations, revenue, check-in rate, status breakdown, session enrollment chart, **per-session breakdown table** (confirmed/cancelled/checked-in counts + capacity + allocated revenue/paid per session, with totals row), recent registrations | inline (loaded by `loadReporting()`) |
| `attendance` | Attendance check-in | inline |
| `notes` | Tasks + event notes | inline |

### `/bookables/:id` → `pages/bookables/[id].vue`
Wraps `<BookableEditor>` plus extra tabs:

| Tab key | What it shows | Key components / DB tables |
|---|---|---|
| `bookings` | Booking calendar for this venue | `<BookingsCalendar>` → `bookings` |
| `offerings` | (PERSON bookables only) Activities owned by this staff member — "What I offer" tab | `<StaffOfferingsEditor>` → `activities` (filtered by `staff_bookable_id`) |
| `details` | Venue info, modes | `<BookableEditor>` → `bookables`, `bookable_modes` |
| `availability` | Availability rules calendar | `<AvailabilityEditor>` → `availability_rules` |
| `sub-venues` | Visual venue map (click-to-select tiles) + **Configurations panel** below it | inline map → `bookables`; configurations → `bookable_configurations` + `bookable_configuration_children` |
| `items` | Items/equipment | inline → `bookable_items` |

**Layouts are gone** — the old `bookable_layouts` table was dropped (migration 107). Sub-divisions now live as actual sub-venue rows + `bookable_configurations` slot groups.

### `/bookables/:id` → `<BookableEditor>` internal tabs (in Details tab)

| Tab key | What it edits | DB columns |
|---|---|---|
| `details` | Name, description, location, features | `bookables.*` |
| `modes` | Booking modes (e.g. "Singles", "Doubles") | `bookable_modes` |
| `activities` | Linked activities | `activity_bookables` |
| `rules` | Max concurrent, booking limits, options | `bookables.booking_limit_type`, `.disallow_concurrent`, etc. |
| `images` | Photos | `bookables.images`, `.main_image` |

### `/activities/:id` → `pages/activities/[id]/index.vue`
Header has back button → `/bookables?tab=activities`. Single-column body (`max-w-4xl mx-auto`) — no tabs:
- **Header bar (right side)**: Copy link + Open booker icon-text buttons next to Save
- **Stacked cards** (top-to-bottom): Details card (Name, Description, Colour, Status + Bookings enabled on one row, **Image upload** at bottom), Modes table (click row → `/activities/:id/modes/:modeId`), **Booking settings card** (Area name singular/plural at top, then `approval_mode`, `booking_window_days`, `min_notice_hours`, `cancellation_window_hours`, `min_duration_mins`, `max_duration_mins`, `buffer_mins`), Venues card, Groups card

### `/activities/:id/modes/:modeId` → `pages/activities/[id]/modes/[modeId].vue`

| Tab key | What it edits | Key components |
|---|---|---|
| `details` | Name, colour, image, **Capacity** card | `<AppCard>`, `<SettingsRow>` |
| `pricing` | Default pricing + per-tier overrides | `<ModePricingTiersEditor>` |
| `addons` | Optional extras (tables, lanes, etc.) | `<ModeAddonsEditor>` |

### Activity `booking_flow` — wizard vs scheduler vs item
Each activity row has a `booking_flow` column:
- `'wizard'` (default) → `<BookingWizard>` — multi-step flow described below
- `'scheduler'` → `<BookingScheduler>` — single-screen grid + side panel; slot-aware (see Phase 2 booking integrity below)
- `'item'` → `<ItemBooker>` — rate-card rental flow for projectors/lockers/etc. No calendar grid. User picks a rate card (`activity_modes.period_unit` + `period_count` + `term_type` + `period_price`), a start date, and (for fixed-term) a number of periods. End_at is computed by adding `period_count × N` of `period_unit` to start. `term_type='recurring'` rentals write `bookings.is_recurring=true` (renewal cron is phase 2 — for now they live as open-ended single bookings ending at the first period's end). Resource picker honours `activities.assignment_mode` (`'system'` auto-assigns, `'member'` forces explicit pick, `'either'` shows "Assign me one" + the unit list).

Set per-activity in the activity detail page. Both `pages/bookings/new.vue` and `pages/book/index.vue` dispatch on `booking_flow` to render the right component.

**Demo seeder:** `/dev/seed-items` creates a sample Projector hire (system-assigned, hourly + daily rates) + Locker rental (10 children, weekly recurring + 6-monthly fixed) for the current org.

### `/bookings/new` (staff) and `/book` (public)
Both are multi-step wizards with similar step keys:

| Step key | What it does |
|---|---|
| `activity` | Pick activity |
| `mode` | Pick mode |
| `resource` | Pick venue/court |
| `datetime` | Pick date + time slot |
| `addons` | Select add-ons |
| `details` | Attendee info |
| `review` | Summary + confirm |

---

## UI Label → Code Location

If the user says a section title, card heading, or tab name, look it up here to find the exact file and area.

| What you see in the UI | File | Where |
|---|---|---|
| **"Bookings enabled"** toggle | `pages/activities/[id]/index.vue` | Details card, below Status |
| **"Area name"** (singular/plural) | `pages/activities/[id]/index.vue` | top row of Booking settings card (above the Timing/Behaviour grid) |
| **"Booking settings"** card | `pages/activities/[id]/index.vue` | stacked card, `<AppCard>` |
| **"Booking behaviour"** toggles | `pages/activities/[id]/index.vue` | Inside Booking settings card, below Buffer time |
| **"Approval"** row (Auto-approved / Requires approval) | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Advance window"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Min notice"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Cancellation"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Duration"** (min/max) row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Buffer time"** row | `pages/activities/[id]/index.vue` | inside Booking settings card |
| **"Modes"** table (activity) | `pages/activities/[id]/index.vue` | stacked card right after Details; click row → mode edit page |
| **"Venues"** card (activity) | `pages/activities/[id]/index.vue` | stacked card |
| **"Groups"** card (activity) | `pages/activities/[id]/index.vue` | stacked card |
| **"Copy link" / "Open booker"** buttons | `pages/activities/[id]/index.vue` | header bar, immediately to the left of the Save button; URL is hidden — Copy writes `bookingLink` to clipboard, Open routes to `/bookings/new?activityId=…` |
| **"Capacity"** card | `pages/activities/[id]/modes/[modeId].vue` | Details tab, `<AppCard>` |
| **"Allow visitors"** toggle | `pages/activities/[id]/modes/[modeId].vue` | inside Capacity card |
| **"Details"** tab (mode) | `pages/activities/[id]/modes/[modeId].vue` | `activeTab === 'details'` |
| **"Pricing"** tab (mode) | `pages/activities/[id]/modes/[modeId].vue` | `<ModePricingTiersEditor>` |
| **"Add-ons"** tab (mode) | `pages/activities/[id]/modes/[modeId].vue` | `<ModeAddonsEditor>` |
| **"Default pricing"** section | `components/ModePricingTiersEditor.vue` | top of component |
| **"Pricing tiers"** section | `components/ModePricingTiersEditor.vue` | below default pricing |
| **"Limit for number of bookings"** | `components/BookableEditor.vue` | Rules tab, ~line 644 |
| **"Options"** (Disallow concurrent/consecutive) | `components/BookableEditor.vue` | Rules tab, ~line 666 |
| **"Max concurrent bookings"** | `components/BookableEditor.vue` | Rules tab, ~line 634 |
| **"Rules / notes"** textarea | `components/BookableEditor.vue` | Rules tab, ~line 638 |
| **"Details"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'details'` |
| **"Modes"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'modes'` |
| **"Activities"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'activities'` |
| **"Rules"** tab (venue editor) | `components/BookableEditor.vue` | `activeTab === 'rules'` |
| **"Availability rules"** calendar | `components/AvailabilityEditor.vue` | full component |
| **"Date Range"** on availability rule | `components/AvailabilityEditor.vue` | form panel, DatePicker pair |
| **"Booking windows"** | `components/BookableScheduleEditor.vue` | full component |
| **"Fee Groups"** | `components/FeeGroupsEditor.vue` | full component |
| **"Add-ons"** (session) | `components/SessionAddonsEditor.vue` | full component; used in `SessionEditor` |
| **"Add-ons"** tab (events/:id) | `pages/events/[id].vue` | `tab-addons` slot in SessionEditor |
| **"Sessions"** tab (events/:id) | `pages/events/[id].vue` | `activeTab === 'sessions'`, session list |
| **"Invitees"** tab (events/:id) | `pages/events/[id].vue` | `<EventInviteeManager>` |
| **"Visibility & Access"** | `pages/events/new-advanced.vue` or `[id].vue` | event settings section |
| **"Bookings"** tab (venue/:id) | `pages/bookables/[id].vue` | `<BookingsCalendar>` |
| **"Availability"** tab (venue/:id) | `pages/bookables/[id].vue` | `<AvailabilityEditor>` |
| **"Sub-venues"** tab (venue/:id) | `pages/bookables/[id].vue` | venue map + Configurations panel |
| **"Configurations"** panel (sub-venues tab) | `pages/bookables/[id].vue` | below the venue map; rows show `slot_name = child + child` chips; edit dialog manages slots |
| **"Set up a sport"** button (toolbar + empty state) | `components/BookablesList.vue` | opens `<SetupWizard>` |
| **"Set up an item"** button (toolbar + Items-tab empty state) | `components/BookablesList.vue` | opens `<ItemWizard>` — only on Items tab |
| **"Set up a coach"** button (toolbar + Persons-tab empty state) | `components/BookablesList.vue` | opens `<CoachWizard>` — only on Persons tab |
| **"Default sessions"** section (Setup wizard step 5) | `components/SetupWizard.vue` | day chips + open/close + slot length + gap; writes activity duration/buffer + one OPEN `availability_rules` per parent court |
| **"Required configuration"** picker (mode editor) | `pages/activities/[id]/modes/[modeId].vue` | Details tab; binds to `form.configuration_key`; options come from `bookable_configurations` rows on the activity's linked bookables, deduped by key |
| **"Bookable scope"** card (mode editor) | `pages/activities/[id]/modes/[modeId].vue` | Details tab; persists to `activity_mode_bookables` |
| **"What's bundled"** card (mode editor) | `pages/activities/[id]/modes/[modeId].vue` | Details tab. Single card with two subsections: **Venue** (unified MultiSelect — for coach activities sources from org-wide venues and writes `activity_mode_resources`; for venue activities sources from the activity's linked bookables and writes `activity_mode_bookables`. Same UI control, semantics chosen by `staff_bookable_id`) and **Equipment** (one list of items, each row has Required ↔ Optional pill toggle that drives `activity_mode_required_items.is_optional`). Replaces the older Bookable-scope-vs-Required-venue dual picker that confused users |
| **"Equipment"** card (booking wizard) | `components/BookingWizard.vue` | Step 5 (Details) — list of org ITEM bookables with quantity inputs. Capacity check sums overlapping `booking_items.quantity` ≤ item's `max_concurrent`; rows write to the new `booking_items` table |
| **"Tile selection + New configuration from selection"** | `pages/bookables/[id].vue` | Sub-venues tab — clicking a child tile on the venue map toggles selection; "New configuration from selection" opens the dialog pre-filled with one slot |
| **"Access controlled venue"** master toggle | `components/BookableAccessEditor.vue` | top of Access tab on `/bookables/:id` — when off, every other section is hidden |
| **"Connected doors / Connected lights"** multi-select | `components/BookableAccessEditor.vue` | Access tab — picks doors/zones from org catalogue; "Manage doors" / "Manage lights" link sends user to `/bookables?tab=access` |
| **"Access code"** card (length + delivery) | `components/BookableAccessEditor.vue` | Access tab |
| **"Unlock window"** card | `components/BookableAccessEditor.vue` | Access tab — minutes-before-start + minutes-after-end |
| **"Lighting schedule"** card | `components/BookableAccessEditor.vue` | Access tab — ramp up/down + level % |
| **"Doors" / "Lights" inner tabs** | `components/AccessControlList.vue` | rendered when `/bookables?tab=access`. Empty states have a "New door" / "New light zone" button. Row-click opens the edit dialog |
| **"How would you like to book?"** chooser | `components/BookingAuthChooser.vue` | Reusable component — 4 buttons + OTP / password / app sub-flows. Used by `<BookingScheduler>`'s auth panel; ready to drop into other forms (`<ItemBooker>`, event registration, etc.) |
| **"Continue"** button (scheduler right rail) | `components/BookingScheduler.vue` | footer of `panelStep === 'build'` — advances to auth chooser; disabled until at least one slot + mode picked |
| **"Email me a code"** / **"Enter the 6-digit code"** | `components/BookingScheduler.vue` | `panelStep === 'otp-email'` / `'otp-code'` — Supabase `signInWithOtp` + `verifyOtp` |
| **"Sign in with password"** (scheduler) | `components/BookingScheduler.vue` | `panelStep === 'password'` — Supabase `signInWithPassword` |
| **"Open in mobile app"** | `components/BookingScheduler.vue` | `panelStep === 'app'` — QR code via `qrcode` package + `friendlymanager://book?…` deep link |
| **"Signed in as …"** banner | `components/BookingScheduler.vue` | top of `panelStep === 'guest'` when `signedInEmail` is set after OTP/password sign-in |
| **"Eligibility"** / conditions | `components/ConditionEditor.vue` | full component |
| **"Registration Window"** | `pages/settings/index.vue` | settings tab |
| **"Calendars"** settings | `pages/settings/calendars.vue` | full page |
| **"Venues"** settings | `pages/settings/venues.vue` | `<BookableEditor>` + `<BookableTreeNode>` |

---

## Stack
- **Nuxt 3** (`ssr: false`) — file-based routing, auto-imports, `<script setup lang="ts">`
- **Vue 3** — Composition API, `reactive()` for forms, `ref()` for scalars
- **PrimeVue v4** — InputText, InputNumber, Select, ToggleSwitch, Button, Dialog, DataTable, DatePicker, etc.
- **Supabase** — Postgres + auth + storage via `useDb()` (admin client)
- **Tailwind CSS v3** + `tailwindcss-primeui` plugin
- **TypeScript** throughout

---

## Key Conventions

### DB Access
Always use `useDb()` — never `useSupabaseClient()` directly in pages/components.
```ts
const db = useDb()
const { data, error } = await (db.from as any)('table_name').select('*').eq('org_id', orgId.value)
```
The `(db.from as any)` cast bypasses stale generated types — intentional.

### Org Context
```ts
const { orgId } = useOrg()   // always scope queries to orgId.value
```

### Primary Brand Color
`#1E2157` → use Tailwind token: `bg-primary`, `text-primary`, `hover:bg-primary-hover`.
For PrimeVue Buttons (can't use Tailwind tokens there): `style="background:#1E2157;border-color:#1E2157"`.

---

## Domain Types — `/types/index.ts`
```ts
import type { Bookable, Activity, ActivityMode, Session, Booking, FMEvent } from '~/types'
// Also re-exports: FeeLineItem, FeeGroup, SessionFeesConfig from useFeeGroups
```

---

## Composables

| Composable | Exports |
|---|---|
| `useDb()` | Supabase admin client |
| `useOrg()` | `{ orgId, orgReady }` |
| `useFeeGroups` | Types + `feeTotal()`, `getSessionFee()`, `defaultFeesConfig()` |
| `useListEditor(getValue, setValue)` | `{ add, remove, patch, move, reorder }` for `{ id }[]` lists |
| `useLocation` | `LocationEntry` type + `locationSummary()` |
| `useRepeatOptions` | `buildRepeatOptions()`, `rruleToSummary()` |
| `useUpload` | `uploadFile(file)` → `{ url }` |
| `useMenuBookables()` | `{ items, reload }` for nav sidebar |
| `useBreadcrumbs()` | Sets layout header breadcrumbs |
| `useCalendarSettingsOpen()` | Boolean ref for calendar settings panel |
| `useBookingDiscounts()` | `{ loadActive, qualifies, bestMatch, amountForDiscount }` — evaluates discount rules against a `BookingContext` |
| `useBookingTokens` | `BOOKING_TOKENS` list + `substituteBookingTokens(template, ctx)` — pass `BOOKING_TOKENS` into `<FeeLineItemsTable :tokens>` so users can insert `{date}/{start_time}/{activity}/{venue}/...` into fee names |
| `useBookableConfigurations()` | `{ saveConfiguration, saveConfigurationFromChildIds }`. Idempotent slot-aware save against `bookable_configurations` + `bookable_configuration_children`. Used by `<SetupWizard>` and `pages/bookables/[id].vue` so both flows write the schema identically |
| `useDeveloperGate()` | Returns `{ isDeveloper, pageKey, loaded, stage, pageApproved, blocked, approvedNavigable, loadApprovedNavigable }`. `isDeveloper` reads `user.app_metadata.role === 'developer'`. `pageKey` matches the `<ReviewWidget>` shape (route pattern + optional `?tab=`). `blocked` is true once the review row has loaded and stage isn't `approved`. The default layout uses this to swap the page slot for a "Not yet approved" stub that lists the approved-and-navigable pages so a dev has somewhere to go. `<ReviewWidget>` is hidden for developers — they're consumers of approved pages, not reviewers |

---

## Key Components

| Component | Purpose |
|---|---|
| `<AppCard title description>` | White rounded card — slots: `title`, `description`, `header-action`, default |
| `<SettingsRow label description tall>` | Label-left + content-right settings row |
| `<FeeLineItemsTable flush tokens>` | Draggable fee rows; name is a multi-line textarea (Shift+Enter for line break); `tokens` enables a `{·}` insert button for booking tokens |
| `<BookablesList>` / `<BookingsList>` / `<ActivitiesList>` / `<BookingDiscountsList>` / `<AccessControlList>` | Extracted tab contents rendered by the unified `/bookables` page. `<AccessControlList>` is the **org-wide doors + lights catalogue** (Doors / Lights inner tabs). Each door row: name, hardware provider/id, default unlock seconds, # connected venues. Each light row: name, hardware provider/id, default level %, # connected venues. CRUD via row-click (edit dialog) and ⋯ menu (delete). Hardware provider options: ZKTeco / HID / Brivo / Nuki / Mock |
| `<BookableAccessEditor bookableId>` | Per-venue access settings — rendered in the **Access** tab of `/bookables/:id`. Master "Access controlled venue" toggle, then door multi-select, light-zone multi-select, code-delivery settings (length 4–12 digits, channel: none / email / sms / both), unlock window (minutes before start + minutes after end), lighting (ramp up/down + default level %). Autosaves on every change. Door/zone link tables (`bookable_doors`, `bookable_light_zones`) saved as a delete-then-insert pair |
| `<SessionEditor>` | Full session panel: dates, fees, add-ons, capacity |
| `<AvailabilityEditor>` | Drag-to-set availability calendar grid |
| `<BookableEditor standalone initialTab>` | Complete venue editor, emits `saved`, `cancel`, `delete` |
| `<StaffOfferingsEditor staffBookableId staffName?>` | "What I offer" tab content for `/bookables/:id` when the bookable is a PERSON (staff). Lists activities owned by this staff (`activities.staff_bookable_id` set) + a "New activity" button. Creating from here auto-sets `staff_bookable_id` and inserts the `activity_bookables` row, then jumps to the activity editor. The activity editor hides the "Venues" linking card and the "Bookable scope" card on modes when `staff_bookable_id` is non-null |
| `<BookingFormFields formId? prefill? hideCores?>` | Reusable form-field renderer. When `formId` is set, loads the matching `registration_forms` + `form_fields` rows and renders each field by `field_type` (SHORT_TEXT / NUMBER / DATE / LONG_TEXT / SINGLE_SELECT / TOGGLE / FILE). When `formId` is null, renders a default First/Last/Email/Phone (ids prefixed `__core_*` so they don't collide with real field ids). Handles per-field visibility conditions internally. Owns its own answers state; emits `@change` with `{ answers, coreValues, isValid }` so the parent can mirror into its own state, drive Confirm-button enablement, or persist the raw payload. `prefill` (object keyed by core name — `first_name`, `last_name`, `email`, `phone`, `attendees`, `notes`) populates fields when supplied. `hideCores` (array of core names) suppresses optional fields irrelevant to the parent's context — e.g. the wizard hides `attendees` unless the mode has `min_people`/`max_people` set or the user has picked a per-person addon. Used by `<ItemBooker>` and `<BookingWizard>` so all booking flows share one render path. |
| `<BookingAuthChooser orgId? appDeepLink? canGoBack? hideGuest? title? subtitle? guestLabel? guestDescription? staff?>` | Reusable "How would you like to book?" auth picker. Owns the four-button chooser plus all sub-flows (OTP email + 6-digit code, email + password, mobile-app QR/deep-link). Built-in **staff member picker** appears at the top when `staff=true` — AutoComplete searches `persons` (first_name / last_name / email ilike) and on select emits `@signed-in` with the member's data so every booking form gets the same registration flow. Uses `useSupabaseClient()` directly. Emits `@select-guest` (user picked Continue as guest), `@signed-in` (with `{email, firstName, lastName, phone}` prefilled from auth, member pick, or `org_members` lookup), `@back` (top-step back button). Exposes a `reset()` handle parents call when the booking is cleared. Provides a `#extra-options` slot above the standard buttons for bespoke additions beyond the built-in member picker. The parent owns the contact/booking form that follows — fields differ between the scheduler, item bookings, event registrations, etc. |
| `<ItemBooker activityId staff? showBackToPicker? embedded?>` | Rate-card rental flow used when `activities.booking_flow='item'`. **Two-column layout:** left column has the booking config (rate cards → start date/time → unit picker); right column is a sticky `w-96` aside that's a state machine: both staff and public start on `panelStep='auth'` showing `<BookingAuthChooser>` ("How would you like to book?"), and switch to `panelStep='details'` (contact form + total + Confirm) once they pick guest or sign in. Staff see the same chooser plus a built-in **"Pick a member"** AutoComplete (provided by `<BookingAuthChooser staff>` itself, not via slot — every booking form using the chooser gets it for free). Guest-button copy also switches to "Type member details" for the manual path. After sign-in the contact form is prefilled and a green "Signed in as …" banner appears with a "Change" link to return to the chooser. Loads modes (filters out modes with `period_unit IS NULL`), shows them as cards (price + period + "Rolling" badge for recurring), then `DatePicker` for start, `InputNumber` for fixed-term period count, an availability-aware unit dropdown driven by `activities.assignment_mode`. Computes `end_at` by adding `period_count × N` of `period_unit`. Pre-flight overlap check re-runs immediately before the insert. Writes one `bookings` row with `is_recurring` set from the mode's `term_type`. |
| `<BookingWizard staff? activityId? presetModeId?>` | **Single source of truth** for both `/book` (public) and `/bookings/new` (staff). When `presetModeId` is supplied alongside `activityId`, the wizard skips the Activity AND Mode steps and lands on Resource — used by the booker's "By service" picker so a customer who chose "Coach Sarah · 30-min lesson" doesn't re-pick what they already chose. 7-step wizard: Activity → Mode → Resource → Date/Time (calendar) → Add-ons → **Details (auth chooser → form)** → Review (with invoice). Details step opens with `<BookingAuthChooser>` (same registration flow as ItemBooker / scheduler — staff get the member picker built-in); once the user picks guest, signs in, or picks a member, it flips to the form view rendered by `<BookingFormFields>` with the picked mode's `form_id` (or default First/Last/Email/Phone). A green "Signed in as …" banner shows after auth, with a "Change" link to return to the chooser. Form-driven Details step uses the mode's `form_id` if set, otherwise a synthetic default form (First Name, Last Name, Email, Phone, People Attending, Notes). Staff-only behavior gated on `staff` prop: categorized items accordion at Resource step (when items have `item_category`), event-link `<Select>` at Details, `checkCapacityViolation()` pre-submit check against `availability_rules.max_concurrent`, direct DB insert (RLS-enforced) instead of `/api/public-booking`, and visibility of non-public bookables. `event_id` saved on `bookings` row when staff links to an event. |
| `<BookingsCalendar>` | Calendar view of bookings for one venue |
| `<ModePricingTiersEditor>` | Default pricing + group tiers with inherit/override |
| `<ModeAddonsEditor>` | Add-ons list for activity modes |
| `<SessionAddonsEditor>` | Add-ons list for event sessions |
| `<LocationEditor>` | Location picker + live availability fetch |
| `<ConditionEditor>` | Recursive eligibility condition builder |
| `<EventInviteeManager>` | Add/remove invitees by group or individual |
| `<DateTimeEditor>` | DatePicker wrapper with time input |
| `<RepeatSelect>` | Recurrence rule selector |
| `<RichTextEditor>` | Markdown / rich-text editor |
| `<FormBuilder v-model context show-back can-delete>` | **Reusable** form builder — left section nav (Settings / Form / Terms) → per-section panels → field editor in sidebar; right pane is a live preview rendering fields via `<FormFieldCanvas>`. Used by `/forms/:id` and activity modes |
| `<FormFieldCanvas v-model editingKey pinnedRoles>` | Sortable field list with drag handles (`.field-drag-handle`), pin support (e.g. first/last name), inline previews per type (text/textarea/select/checkbox/date/file/email/phone/number) and block types (section/image/text-block/button). Used by `<FormBuilder>` and the events `/events/:id?tab=forms` field area |
| `<FormFieldAdvancedEditor field condition-field-options>` | Shared "Advanced" tab for the field editor — Visibility Conditions + Financial Rules (fee/discount). Mutates `field` by reference; self-contained add/remove/toggle handlers. Used by both `<FormBuilder>` (field editor sidebar) and `pages/events/[id].vue` (forms tab field editor) |
| `<EventFormDesignPanel design audience>` | Right-rail Settings panel for the events forms tab — audience pills, form style, header image source, info icons, description, form heading, add-person colour, page background, sponsors. Mutates `design` by reference; emits `back`, `save`, `update:audience`, `image-upload` |
| `<FormPreviewBanner design event>` | 220px-tall preview banner: custom header image, fallback gradient, optional `event.banner_url`, event title overlay |
| `<FormPreviewInfoIcons design event>` | Info-icons row (date / time / cost / location / criteria) — each toggled by `design.icons.<key>` |
| `<FormPreviewDescription design event>` | Switches between event-mode (read-only) and custom-mode (`<RichTextEditor v-model="design.customDescription">`) |
| `<FormPreviewPayment payment v-model:selected>` | Shows enabled payment methods (plan / credit_card / invoice / coupon) using `<FormsPaymentOptionCard>`; emits `update:selected` |
| `<PaymentOptionsEditor v-model defaultModel bankAccounts bankAccountId>` | Toggle-switch list of methods (Invoice / Credit Card / Payment Plan / Coupon) with optional "Default" badge + bank-account picker on Invoice. Used in `/settings` (org defaults for both bookings and events) and the activity-mode editor |
| `<CoachWizard v-model:visible @done>` | One-shot coach setup. Pick a discipline preset (Tennis / Swimming / Personal Trainer / Yoga / Football / Custom) → fill in name + optional email/phone + service category → tweak the preset's offerings (rate cards: name + every/unit + price). Wizard creates a PERSON bookable (email/phone stored in `custom_fields` jsonb), an owning activity with `staff_bookable_id` set + name = coach name, an `activity_bookables` row, and one `activity_modes` row per offering (each tagged with the picked category so the booker's "By service" cards surface them). On done, jumps to `/bookables/:id?tab=offerings` so the user lands on "What I offer" ready to refine. Catalogue lives inside the component. Entry from `<BookablesList>` Persons tab toolbar + empty state |
| `<ItemWizard v-model:visible @done>` | One-shot item-rental setup. Pick preset (Projector / Lockers / Meeting room / Bike fleet / Equipment kit / Custom) → name the item → unit count → assignment mode (when count > 1) → rates list (each row: name + period count/unit + term + price) → activity name. Wizard creates one bookable (count=1) or a parent + N children (count>1), an activity with `booking_flow='item'` + `assignment_mode`, an `activity_bookables` row, and an `activity_modes` row per rate. Catalogue lives inside the component. Entry from `<BookablesList>` Items tab toolbar + empty state |
| `<ModeWizard v-model:visible :activity-name? @done>` | Reusable Dialog for capturing a single `activity_modes` row. Three sections (Basics: name/description/colour; Capacity: min/max people + visitors toggle, gated behind a switch; Pricing: default price, gated behind a switch). Footer offers **Save** (closes) and **Save & add another** (resets form, stays open) so users can chain creates. Emits `done` with a typed `ModePayload`; the caller decides whether to write to the DB now or queue for later. Wired into two places: (1) `pages/bookables/new.vue` step 2 — pops automatically the moment a new activity is added inline, so users are walked through mode capture immediately rather than having to find the "+ Add mode" link; queued new-activity rows still expose the link for adding more modes later; captured modes ride along at submit time and replace the auto-seeded "Default" mode. Cancelling leaves the activity with zero modes (the "Default" seed kicks in at submit). (2) `pages/activities/[id]/index.vue` modes table — the **Add** button opens the wizard instead of navigating to `/modes/new`; on `done` the row is inserted into `activity_modes` and appended to the modes list. The dedicated `/activities/:id/modes/:modeId` page is still used for editing pricing tiers, addons, and other advanced fields |
| `<SetupWizard v-model:visible @done>` | One-shot sport setup. Pick sport → name the facility → count of courts → tick preset modes (Singles, Mini-tennis, Kids coaching…) → activity name → **default sessions** (days, open/close, slot length, gap). Wizard creates a top-level facility venue, the activity is forced to `booking_flow='scheduler'` (sport-style activities use the single-screen scheduler grid), N child courts (master + linked siblings), the **finest** required division as actual sub-venues (Q1–Q4 only — coarser configs become slot groupings), `bookable_configurations` rows for every picked mode's `requires`, the activity (with `min_duration_mins` = `max_duration_mins` = slot length, `buffer_mins` = gap), one `availability_rules` OPEN row per parent court whose `time_slots[]` is populated with every session sliced from the open window (the calendar/scheduler iterates `time_slots` to render bookable cells — a single block would render as one slot; skipped if user clears all days), the activity modes wired to `configuration_key`, `activity_bookables` linking activity → courts, and explicit `activity_mode_bookables` per-mode scope. Catalogue (sports + presetModes) lives inside the component. Entry from `<BookablesList>` toolbar + empty states |
| `<BookingScheduler activityId staff? presetBookableId presetStart presetEnd>` | Alternative to `<BookingWizard>` for activities with `booking_flow='scheduler'`. Single-screen: venue cards on left (auto-narrowed by mode scope + active configuration), SubVenueScheduler / BookingsCalendar grid, multi-slot drag select, sponsor strip; right pane builds the booking. **Right pane is a state machine** (`panelStep`): `build` (slots + mode + add-ons + Continue) → `auth` (4-button chooser: Continue as guest / Open in mobile app / Email me a one-time code / Sign in with password) → `guest` (contact form, prefilled when arrived via auth) / `otp-email` → `otp-code` / `password` / `app` (QR code via `qrcode` package + `friendlymanager://book?…` deep link). Auth uses `useSupabaseClient()` (`signInWithOtp` + `verifyOtp`, `signInWithPassword`); on success `prefillFromUser()` pulls name/email/phone from auth + `org_members`. Slot-aware: when a mode's `configuration_key` matches a configuration on the parent, picking a slot inserts one primary booking + N child bookings (linked via `parent_booking_id`) so every member sub-venue is blocked atomically. Initial `load()` and `venueGroups` watcher are wired in `onMounted` to avoid TDZ on `pendingModeId` / `allowMultiSlot` |
| `<VenueLibraryDialog v-model:visible @apply>` | Sport-themed picker with "Multiple [type]s" + "Configurations" tabs. Emits `{ type, division, configKey, configName, children, count, baseName }`. Used by the sub-venues tab on a parent venue's first sub-venue add |
| `<DivisionDiagram sections regions orientation courtType>` | SVG renderer for sport courts with section dividers — tennis lines, basketball keys, netball thirds, football pitch, cricket nets, pool lanes, sports hall badminton overlay. Falls back to plain emerald tiles when `courtType` is null. Used by `<VenueLibraryDialog>` |
| `<ReviewWidget>` | In-app prototype review system. Inline pill in the layout header, immediately to the right of the red "Early prototype" banner. Expanded panel pops out as a `fixed top-16 right-4` overlay so it floats above page content while staying anchored under the header. Keys on **`pageKey` = route pattern (`route.matched[].path`) + (`?tab=…`)** — e.g. `/activities/:id?tab=details`, **not** the raw `/activities/abc-uuid?tab=details`. So dynamic instances collapse into a single "page" (reviewers approve the screen, not the data behind it) and each tab on a page gets its own approval state. Templated rows in the Report aren't clickable (no real path to navigate to). **Compact view:** stage chip (Draft / In review / Approved) + comment-bell with red unresolved count badge. **Expanded panel** has two tabs: **This page** (stage toggle, **Sign-offs** list — one row per reviewer with click-to-sign / click-to-revoke + relative timestamp; auto-bumps stage to `approved` when every reviewer has signed; clicking Sign Off on the last reviewer is what triggers it; revoking an approved page demotes back to `in_review`; "Add comment" pin-mode + Hide-resolved toggle; resolved pins remain visible greyed-out with a Reopen action) and **Report** (per-reviewer totals card + a `pages × reviewers` matrix table — click a row to navigate to that path+tab; ✓ icon per cell where the reviewer signed). **Pin flow:** click "Add comment" → cursor turns to crosshair → click anywhere in `<main>` → Dialog → typed body + Post = one `page_comments` row anchored to (x, y) inside `<main>`. Pins render as numbered amber circles via `<Teleport>` into `<main>` (resolved = grey w/ strikethrough). First feedback auto-bumps stage from `draft` → `in_review`. **Auto-seeds 5 default reviewers** the first time the widget loads against an org with no `page_reviewers` rows — Kate (PM), Rodd (CEO), Jade, Shontell, Jono (Customer). Wired in `layouts/default.vue` (skipped on `embed` layout / public booker). **Delete is dev-only:** a trash icon appears beside Resolve/Reopen on every comment + reply (and as a Delete button in the view dialog) only when `useDeveloperGate().isDeveloper` is true; deleting cascades — the comment row plus any replies pinned underneath are wiped in one query. DB: `page_reviews` (per `(org_id, pageKey)` stage row), `page_comments` (per pin / page-level note), `page_reviewers` (the team), `page_signoffs` (per `(pageKey, reviewer)` approval row) |

---

## DB Schema — Key Tables

| Table | Important columns |
|---|---|
| `bookables` | `id, org_id, name, type, parent_id, master_id, max_concurrent, booking_limit_type, booking_limit_count, disallow_concurrent, disallow_consecutive, allow_modes_with_others, allow_sub_venues, auto_resolve_children, rules, status, is_public, sections (text[])`. `auto_resolve_children` (migration 113) — when `true`, the booker doesn't see this bookable's children as separate columns; the system picks a slot at booking time based on the mode's `configuration_key`. Set `true` on courts/fields with halves+quarters; `false` on facilities (Tennis Courts) and on bookables whose children are physically distinct units (Competition Pool's lanes, Locker Room's lockers) |
| `bookable_modes` | `id, bookable_id, name, color, activity_mode_ids (uuid[])` |
| `bookable_configurations` | `id, parent_bookable_id, key, name, sort_order` — named layouts owned by a parent venue (e.g. Court 1 → Halves / Quarters). `unique(parent_bookable_id, key)` |
| `bookable_configuration_children` | `configuration_id, bookable_id, sort_order, slot_index, slot_name` — slot membership. A "Halves" config has two slot_indexes (0=Half A, 1=Half B); each slot can list multiple sub-venues (Half A = {Q1, Q2}). Booking the slot blocks every member atomically |
| `availability_rules` | `id, bookable_id, name, type, days (int[]), start_time, end_time, valid_from, valid_until` |
| `activities` | `id, org_id, name, description, color, icon, image_url, status, staff_bookable_id (migration 119; non-null = activity is owned by one staff/PERSON bookable, hidden from the global Activities list, edit happens on the staff's "What I offer" tab), area_name_singular, area_name_plural, bookings_enabled, booking_flow ('wizard' \| 'scheduler' \| 'item'), assignment_mode ('system' \| 'member' \| 'either', migration 116) for item flows, approval_mode, booking_window_days, min_notice_hours, cancellation_window_hours, min_duration_mins, max_duration_mins, buffer_mins, allow_multi_slot, allow_multi_slot_peak, allow_kiosk, allow_recurring, allow_member_changes, auto_remove_unpaid, require_visitor_names, hide_member_names` |
| `activity_modes` | `id, activity_id, name, color, pricing (jsonb), addons (jsonb), allow_visitors, min_people, max_people, min_visitors, max_visitors, configuration_key, image_url, sort_order, approval_mode, form_id, default_booking_view, payment_options (jsonb)`. **Item modes (migration 116):** `period_unit ('hour'\|'day'\|'week'\|'month'\|'year', null on non-item modes)`, `period_count int default 1`, `term_type ('fixed'\|'recurring')`, `period_price numeric` — `<ItemBooker>` reads these and ignores `pricing` jsonb. **Service category (migration 120):** `category text` (free text + autocomplete from org's existing values) drives the booker's "By service" cards |
| `activity_bookables` | `activity_id, bookable_id` (join table) |
| `activity_mode_bookables` | `mode_id, bookable_id, price_override` — per-mode scope (migration 108) plus per-bookable price override (migration 118). Empty `mode_id` row list = "all activity bookables"; otherwise narrows the picker. `price_override` (nullable numeric) overrides the mode's own price for that specific bookable — used by `<BookableServicesEditor>` so each coach/item/venue can charge a different rate for the same shared mode. The `<BookableServicesEditor>` save backfills null-override rows for peer bookables when an implicit-scope mode gets its first override, so the scope stays implicit-equivalent |
| `activity_mode_resources` | `mode_id, bookable_id, sort_order` (migration 117) — venues a coach mode reserves alongside the primary booking. Multiple rows = a pool the system picks from at submit time (first non-overlapping wins). Empty = no venue requirement |
| `activity_mode_required_items` | `id, mode_id, bookable_id, quantity, sort_order, is_optional, price_override` (migrations 121 + 122 + 123) — equipment a mode declares. `is_optional=false` rows = auto-reserved on every booking, shown as locked rows in the booker's Equipment section. `is_optional=true` rows = customer-pickable extras that surface as editable rows. `price_override numeric(10,2)` is the per-unit price (null = free); BookingWizard multiplies by qty and adds an invoice line per item with a price |
| `booking_items` | `id, booking_id, bookable_id, quantity, sort_order` (migration 117) — fungible equipment (footballs, cones, nets) bundled with one booking. Capacity check sums overlapping `quantity` against the item bookable's `max_concurrent`. Standalone item rentals (lockers/projector via `<ItemBooker>`) keep using one-booking-per-unit and don't touch this table |
| `activity_groups` | `activity_id, group_id` (join table) |
| `sessions` | `id, event_id, start_at, end_at, status, fees (jsonb), addons (jsonb)` |
| `bookings` | `id, org_id, bookable_id, activity_id, activity_mode_id, start_at, end_at, status, parent_booking_id, is_recurring` — `parent_booking_id` (migration 111) self-FK so multi-bookable slot reservations show as one logical booking with N atomic children. `is_recurring` (migration 116) set when the booked mode's `term_type='recurring'`; renewal cron is phase 2 |
| `booking_discounts` | `id, org_id, name, form_text, modifier_type ('PERCENT'\|'FLAT'), modifier_value, apply_to, conditions (jsonb), valid_from, valid_until, max_uses, uses_count, is_active` |
| `booking_discount_activities` | `discount_id, activity_id` (join; empty on both = all) |
| `booking_discount_activity_modes` | `discount_id, activity_mode_id` (join; only used when scoping to specific modes within an activity) |
| `bookings` (discount cols) | `booking_discount_id, discount_amount` — set when public booking applies a discount |
| `bookings` (access cols, migration 124) | `access_code, access_code_delivered_at` — populated by `/api/finalize-access` after a CONFIRMED booking on an access-enabled venue. Idempotent — re-finalising returns `{ skipped: 'already-finalised' }`. Children of a multi-bookable slot booking inherit from the primary (`parent_booking_id` is set), so finalisation skips them |
| `member_groups` | `id, org_id, name, color` |
| `member_group_schedules` (migrations 130 + 131) | `id, org_id, group_id, day_of_week (0=Sun..6=Sat), start_time, end_time, location (jsonb LocationEntry — type ADDRESS/BOOKABLE/ONLINE), sort_order`. Weekly training schedules for a member group (e.g. "Monday 3pm-5pm Field 2"). Edited via the standard `<LocationEditor :multi="false">` so the address/venue/online tabs and the venue tree are shared with the event flows; save uses delete-then-insert scoped to `group_id` |
| `doors` (migration 124) | `id, org_id, name, location_note, hardware_provider ('zkteco'\|'hid'\|'brivo'\|'nuki'\|'mock'\|null), hardware_id, default_unlock_seconds, is_active` |
| `light_zones` (migration 124) | `id, org_id, name, hardware_provider, hardware_id, default_level_percent, is_active` |
| `bookable_doors` (migration 124) | `bookable_id, door_id, sort_order` — which doors are connected to a venue |
| `bookable_light_zones` (migration 124) | `bookable_id, zone_id, sort_order` — which light zones are connected to a venue |
| `bookables` (access cols, migration 124) | `access_enabled, access_code_delivery, access_code_length, access_unlock_before_mins, access_unlock_after_mins, lighting_ramp_up_mins, lighting_ramp_down_mins, lighting_level_percent` |
| `physical_schedules` (migration 124) | `id, booking_id, event_id, session_id, bookable_id, door_id, light_zone_id, scheduled_on_at, scheduled_off_at, level_percent, override_on_at, override_off_at, delivered_at, delivery_error`. Exactly one of `door_id` or `light_zone_id` is set (CHECK). One row per connected door + one per connected zone is materialised when `/api/finalize-access` runs. `delivered_at` stays null until a worker pushes the command to the vendor API |
| `page_reviews` (migration 125) | `id, org_id, path, stage ('draft'\|'in_review'\|'approved'), approved_by, approved_at, updated_at, created_at`. One row per `(org_id, path)` — drives the `<ReviewWidget>` stage chip. **`path` stores the widget's `pageKey`** = route pattern + optional `?tab=…` (e.g. `/activities/:id?tab=details`), so each tab on a page is tracked independently AND every instance of a templated route shares one approval state |
| `page_comments` (migration 125) | `id, org_id, path, body, author_id, author_name, x numeric, y numeric, resolved, resolved_by, resolved_at, created_at`. `path` = widget pageKey (route pattern). `(x, y)` are pixel coords inside the page's `<main>` scroll container; null = page-level (not pinned). Resolved rows still rendered in the widget (greyed) — toggle "Hide resolved" hides them |
| `page_reviewers` (migration 126) | `id, org_id, name, role, color, sort_order, created_at`. Org-scoped list of named reviewers. Auto-seeded the first time `<ReviewWidget>` loads against an org with zero rows: Kate (PM), Rodd (CEO), Jade, Shontell, Jono (Customer) |
| `page_signoffs` (migration 126) | `id, org_id, path, reviewer_id, signed_by_user_id, note, signed_at`. `path` = widget pageKey. Unique on `(org_id, path, reviewer_id)`. Drives the Sign-offs list on the page panel and the Report matrix |

---

## Code Patterns

### Settings rows
```vue
<AppCard title="Booking settings" description="...">
  <div class="divide-y divide-gray-100">
    <SettingsRow label="Min notice" description="Before start time">
      <ToggleSwitch :modelValue="form.min_notice_hours !== null"
        @update:modelValue="v => form.min_notice_hours = v ? 2 : null" />
      <InputNumber v-if="form.min_notice_hours !== null" v-model="form.min_notice_hours" class="w-20" />
      <span v-else class="text-sm text-gray-400">None</span>
    </SettingsRow>
  </div>
</AppCard>
```

### List editors
```ts
const { add, remove, patch } = useListEditor(
  () => props.modelValue,
  v => emit('update:modelValue', v)
)
```

### Inline event handlers — never use TypeScript or if-statements
```vue
<!-- WRONG — template compiler rejects these -->
@change="if (x) y = null"
@change="(e: any) => handler(e)"

<!-- RIGHT -->
@change="onUnitChange"          <!-- named method -->
@click="x ? doA() : doB()"     <!-- ternary expression only -->
```

### Native `<select>` with PrimeVue
PrimeVue sets `appearance: none` globally. Restore with inline style:
```vue
<select :value="unit" style="-webkit-appearance:auto;appearance:auto;border:none;background:white;"
  @change="onUnitChange">
```
And handle the change event with a named method — no type annotations in the handler.

---

## Configuration / slot model (Phase 2 booking integrity)

Configurations are **named groups of slots**, where each slot lists physical sub-venues that get booked atomically together. So a Tennis Court that needs both halves and quarters has:
- Physical sub-venues: Q1, Q2, Q3, Q4 (the **finest** division — only level that exists as `bookables` rows)
- "Quarters" config: 4 slots, each one quarter
- "Halves" config: 2 slots — Half A = {Q1, Q2}, Half B = {Q3, Q4}

When a booking targets a slot, `<BookingScheduler>` inserts:
- One **primary** booking on the first member sub-venue (no `parent_booking_id`)
- One **child** booking per remaining member, each with `parent_booking_id` = primary's id

So booking "Half A" on Court 1 writes two `bookings` rows on Q1 and Q2 — both calendars show busy, no double-booking possible. The pre-flight check in `submit()` queries every member sub-venue across the picked slots before writing, aborting with a toast if any overlap exists.

**Known gap:** the calendar grid (`<BookingsCalendar>` / `<SubVenueScheduler>`) doesn't yet visually cross-block sub-venues sharing a slot — Q1's column shows free even when Q2 is booked in the same Halves slot. The pre-flight check stops the bad write; the visual polish is still to come.

---

## Migrations
Numbered sequentially in `/supabase/migrations/` (currently up to `133_`).
```bash
npx supabase db push   # no Docker needed — pushes to remote project
```

Recent migrations worth knowing:
- `133_event_member_group_schedule.sql` — `events.member_group_schedule_id` nullable FK so each training event traces back to the schedule row that produced it. Combined with `events.member_group_id`, this gives "one event per training slot, all linked to the group" semantics — cross-training reporting still aggregates via `member_group_id`
- `132_org_season.sql` — adds `organisations.season_start` + `organisations.season_end` (dates). Surfaced on `/settings` General tab; `/dev/seed-items` populates the defaults to (today − 14 days) and (today + 4 months)
- `131_member_group_schedule_location.sql` — swaps `member_group_schedules.bookable_id` for a `location jsonb` (LocationEntry) so the Session Times editor on `/groups/:id` reuses the standard `<LocationEditor>` (Address / Venue / Online tabs + multi-venue tree). Existing rows are backfilled into a BOOKABLE entry containing the old id
- `130_member_group_schedules.sql` — `member_group_schedules` table for weekly training slots on a member group (day_of_week + start_time + end_time). Edited from the Session Times panel on `/groups/:id`
- `108_activity_mode_bookables.sql` — per-mode bookable scope
- `109_bookable_configurations.sql` — `bookable_configurations` + `bookable_configuration_children` + `activity_modes.configuration_key`
- `110_configuration_slots.sql` — `slot_index` + `slot_name` on configuration children (multi-member slots like "Half A = Q1+Q2")
- `111_booking_parent_link.sql` — `bookings.parent_booking_id` (atomic multi-bookable slot reservations)
- `112_booking_indexes.sql` — `(bookable_id, start_at)` compound index hot-pathed by every availability check + conflict pre-flight; activity_id index; partial index on active statuses
- `113_auto_resolve_children.sql` — `bookables.auto_resolve_children` flag controlling whether the booker picks among children explicitly or the system resolves them at booking time
- `126_page_signoffs.sql` — multi-person sign-off layer over `page_reviews`. `page_reviewers` (org-scoped team — auto-seeded with Kate/Rodd/Jade/Shontell/Jono) + `page_signoffs` (per-reviewer per-pageKey approval row, unique). Drives the Sign-offs list + Report matrix in `<ReviewWidget>`
- `125_page_reviews.sql` — in-app prototype review system. `page_reviews` (per-path stage) + `page_comments` (pinned + page-level notes). The `path` column stores `route.path + ?tab=…` so each tab gets its own state. Drives `<ReviewWidget>` in the default layout
- `124_access_control.sql` — physical access. Drops the unused `access_profiles` / `lighting_profiles` from migration 001. Adds:
  - `doors` (org-scoped): `name, location_note, hardware_provider, hardware_id, default_unlock_seconds, is_active`
  - `light_zones` (org-scoped): `name, hardware_provider, hardware_id, default_level_percent, is_active`
  - Joins `bookable_doors` and `bookable_light_zones` (which doors/lights are connected to a venue)
  - Per-venue settings on `bookables`: `access_enabled, access_code_delivery ('none'|'email'|'sms'|'both'), access_code_length, access_unlock_before_mins, access_unlock_after_mins, lighting_ramp_up_mins, lighting_ramp_down_mins, lighting_level_percent`
  - Per-booking output on `bookings`: `access_code, access_code_delivered_at`
  - Recreates `physical_schedules` tied directly to `door_id` *or* `light_zone_id` (one of, not both) plus optional `booking_id`. `delivered_at` stays null until a worker pushes the command to the vendor API (hardware integration is post-prototype)

---

## Access control flow

End-to-end: org-wide door/light catalogue → per-venue connection → booking-side code + unlock window.

1. **Catalogue** (`<AccessControlList>` at `/bookables?tab=access`) — staff CRUD `doors` and `light_zones` rows. Hardware `provider` + `id` are free text for now (real vendor integration is later).
2. **Connection** (`<BookableAccessEditor>` on `/bookables/:id?tab=access`) — staff toggle `bookables.access_enabled` and pick which doors / light zones serve this venue; saved into `bookable_doors` and `bookable_light_zones`.
3. **Booking submit** — every booking insert path calls `$fetch('/api/finalize-access', { body: { bookingId } })` after the row exists, **only when the booking is CONFIRMED** (PENDING bookings don't generate codes — no point until approved). Wired in:
   - `server/api/public-booking.post.ts` (after notification + confirmation email)
   - `components/BookingScheduler.vue` (one call per primary booking; child slot members inherit)
   - `components/BookingWizard.vue`
   - `components/ItemBooker.vue`
4. **`/api/finalize-access`** — idempotent. Loads the booking + bookable, no-ops when access isn't enabled / already finalised / the booking is a child of a multi-bookable slot. Otherwise: generates an N-digit numeric code (length from `bookables.access_code_length`), updates `bookings.access_code`, materialises one `physical_schedules` row per connected door (with the unlock-before/after window) and one per light zone (with the lighting-ramp window + `level_percent`). Then if `bookables.access_code_delivery` is `email` or `both`, calls `/api/send-access-code-email` and stamps `bookings.access_code_delivered_at`.
5. **`/api/send-access-code-email`** — Resend-backed email containing the code, the venue, the unlock window message. Same stub-when-no-RESEND_KEY pattern as the other senders. SMS path is intentionally a stub for now.


---

# Ruflo / Claude-Flow Integration (auto-generated by ruflo init)


## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({ prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher", name: "researcher", run_in_background: true })
Agent({ prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect", name: "architect", run_in_background: true })
Agent({ prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder", name: "coder", run_in_background: true })
Agent({ prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester", name: "tester", run_in_background: true })
Agent({ prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer", name: "reviewer", run_in_background: true })

// Kick off the pipeline
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" })
```

### Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

## Swarm & Routing

### Config
- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task | Agents | Topology |
|------|--------|----------|
| Bug Fix | researcher, coder, tester | hierarchical |
| Feature | architect, coder, tester, reviewer | hierarchical |
| Refactor | architect, coder, reviewer | hierarchical |
| Performance | perf-engineer, coder | hierarchical |
| Security | security-architect, auditor | hierarchical |

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2 | Haiku | Simple tasks, low complexity |
| 3 | Sonnet/Opus | Architecture, security, complex reasoning |

## Memory & Learning

### Before Any Task
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### After Success
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker | When |
|--------|------|
| `audit` | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features |
| `map` | Every 5+ file changes |
| `document` | After API changes |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing

```bash
npm run build && npm test
```

## CLI Quick Reference

```bash
npx @claude-flow/cli@latest init --wizard           # Setup
npx @claude-flow/cli@latest swarm init --v3-mode     # Start swarm
npx @claude-flow/cli@latest memory search --query "" # Vector search
npx @claude-flow/cli@latest hooks route --task ""    # Route to agent
npx @claude-flow/cli@latest doctor --fix             # Diagnostics
npx @claude-flow/cli@latest security scan            # Security scan
npx @claude-flow/cli@latest performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

```bash
claude mcp add claude-flow -- npx -y @claude-flow/cli@latest
npx @claude-flow/cli@latest daemon start
npx @claude-flow/cli@latest doctor --fix
```

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.
