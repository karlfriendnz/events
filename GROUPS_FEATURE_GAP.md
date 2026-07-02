# Groups / Codes — Old FM vs New Architecture: Feature Gap Analysis

_Comparison run 2026-07-02 against the old FriendlyManager UAT (Olympia Gymnastic Sports Inc,
`olympiagymnastics.uat.friendlymanager.com`) "Classes" area, versus the new fm-events
Groups/Codes/Waitlist system._

**Goal: we need to have all of these features.** This doc is the build list.

## Terminology map

| Old FM | New system |
|---|---|
| **Classes** | **Groups** (`member_groups`, `/groups`, `<ClassesBoard>`) |
| **Programmes** (`/groups/codes`) | **Codes** (`group_codes`, `/groups/codes`) |
| **Terms** | `org_terms` (`/settings/memberships`) |
| **Programme Managers** | Code staff roles + people-in-roles (`code_staff`, `code_role_defs`) |

---

## 🟥 Significant gaps (build these)

### 1. Retention Report — ✅ BUILT (`/groups/retention`)
Old FM: `Classes → Retention Report`. Compare **Term A → Term B** (each with an optional class
filter) and produce:
- A **growth headline** — e.g. `Growth: +13 (2%)` with a segmented bar: **New · Rejoined · Transferred · Remaining**.
- A **per-person table**: Name · Phone · Email · Join Date · **Overdue** (outstanding fees) · ✓ in Term A · ✓ in Term B · **Status** (New / Rejoined / Transferred / Remaining).
- **Mailer** action (email the filtered set) + **Download CSV**.

Status definitions (inferred): **Transferred** = in both terms; **Remaining** = in A, not yet in B;
**Rejoined** = in B, gap before; **New** = first join in B.

New system: **nothing equivalent.** High value, self-contained (reads `member_group_memberships`
scoped by `term_id` across two terms — no new schema needed).

### 2. Term registration lifecycle
Old FM Terms carry more than dates:
- **Term Set (A–F)** — different programmes can run on different term calendars.
- **Signup Open / Signup Close** dates — the public registration window.
- **Priority Open date + email** — early-access window for returning members (+ the notification email).

New `org_terms` has only name/start/end/status. This is the machinery the public "signup goes live"
flow needs — our `<ClassesBoard>` "Signup: Live" is currently an approximation
("minus the public/term-window checks the new schema lacks").

### 3. Week View (timetable) — ✅ BUILT (`/groups/timetable`)
Old FM: `Classes → Week View` toggle — a weekly grid, **columns = weekday**, each class a pill with
name + time + programme. Functional but plain (flat lists per day).

New system: **shipped** — a true time-of-day × weekday grid (`<TimetableGrid>` + `useClassTimetable`),
auto-fitting the visible window to the sessions, Google-calendar-style overlap lanes, colour-coded by
code/programme, a live "now" line, capacity/coach on each block, Term/Code/Venue/Coach filters, a
utilisation summary strip + legend, and a per-day agenda on mobile. Reads `member_group_schedules` —
no new schema.

---

## 🟧 Medium gaps

4. **Gymnasts-per-Staff ratio** on a class (e.g. 10:1). We have staff-role *minimums* but not a member:staff ratio.
5. **Explicit public-signup toggle** — per class **"Show this class on website / signup form"** + per-programme **"Publish All"** publish setting. We *derive* signup-live from fee options; no explicit switch.
6. **Class Announcement** — one-click "email everyone in this class" from the Classes menu. (Verify our comms coverage.)
7. **Members Report / Classes Report** — dedicated class-roster + class-summary reports (menu confirmed; not fully opened — verify our reporting covers them).

## 🟨 Minor / different-by-design

8. **Numeric Age Limits (min–max)** on a class vs our free-text `age_range` ("8-12").
9. **Archived classes** — old FM archives classes (a programme manager can archive). Ours derives "history" from a past term; no explicit archive flag.
10. **Waitlist model differs** — old FM = a flat **cross-club table** (one row per person-per-class). Ours = a **shared queue across equivalent groups** with ordering (custom/FIFO/priority), notes+channel, status, term rollover, full-group→waitlist/sibling routing — richer queue mgmt. ✅ **Now added**: per-row **Age / Enrolled-classes / Date-added** columns, a **spare-spaces** indicator, **CSV export**, and a per-row **"Enrol" action** that places a waitlisted person into a connected group with space and removes them from the queue ("get them off the waitlist"). _Still open:_ a global cross-club "everyone waiting" table.
11. **Programme "Manager"** capability includes **"archive classes"** — our code-roles cover create/add-people but not archive.

---

## ✅ Where the new system is at parity or ahead

- **Codes/Programmes**: hierarchy, class counts, managers, drag-reorder — parity; PLUS term inheritance, member-type, staff roles *with capabilities + per-role minimums*, positions + per-position minimums, default roles/positions.
- **Waitlist**: ahead — shared across equivalent groups, custom/FIFO/priority ordering, notes+channel, term rollover, full-group→waitlist/sibling routing on add.
- **Group detail**: sub-groups kanban, positions, multiple fee options, memberships/terms, attendance matrix, People-tab columns/export, per-row notes.
- **Allocator**, **term rollover**, **person notes (+ interaction channel)** — present.

---

## Recommended build order

1. **Term signup windows + Term Sets + priority signup** (backbone for public signup) — schema + `org_terms`/`useTermsMemberships` + `/settings/memberships` UI + wire `<ClassesBoard>` "Signup live" to the real window.
2. **Retention Report** — high value, self-contained.
3. **Week View timetable** — flagship UI.
4. Smaller items: staff ratio, per-class signup toggle + per-code publish, numeric age limits, archive flag, waitlist global table/CSV.

_✅ Delivered by the background agent: **Retention Report** (`/groups/retention`) + **Week View** (`/groups/timetable`) — both live in the Groups nav flyout, reading existing data (no migrations)._
