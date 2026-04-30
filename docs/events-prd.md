# FriendlyManager Events Module — Product Requirements Document

**Version:** 1.0  
**Date:** 2026-04-23  
**Status:** In Development  
**Author:** FriendlyManager Product Team

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Users & Personas](#2-users--personas)
3. [Event Styles](#3-event-styles)
4. [Screen Map & URLs](#4-screen-map--urls)
5. [Feature: Event List & Calendar](#5-feature-event-list--calendar)
6. [Feature: Create Basic Event](#6-feature-create-basic-event)
7. [Feature: Create Advanced Event](#7-feature-create-advanced-event)
8. [Feature: Create Multi-Session Event](#8-feature-create-multi-session-event)
9. [Feature: Event Detail — Overview Tab](#9-feature-event-detail--overview-tab)
10. [Feature: Event Detail — Sessions Tab](#10-feature-event-detail--sessions-tab)
11. [Feature: Event Detail — Invitees Tab](#11-feature-event-detail--invitees-tab)
12. [Feature: Event Detail — Forms Tab](#12-feature-event-detail--forms-tab)
13. [Feature: Event Detail — Discounts Tab](#13-feature-event-detail--discounts-tab)
14. [Feature: Event Detail — Tickets Tab](#14-feature-event-detail--tickets-tab)
15. [Feature: Event Detail — Communication Tab](#15-feature-event-detail--communication-tab)
16. [Feature: Event Detail — Automation Tab](#16-feature-event-detail--automation-tab)
17. [Feature: Event Detail — Attendance Tab](#17-feature-event-detail--attendance-tab)
18. [Feature: Event Detail — Reporting Tab](#18-feature-event-detail--reporting-tab)
19. [Feature: Event Detail — Notes & Tasks Tab](#19-feature-event-detail--notes--tasks-tab)
20. [Feature: Event Settings Tab](#20-feature-event-settings-tab)
21. [Feature: Categories](#21-feature-categories)
22. [Feature: Named Calendars](#22-feature-named-calendars)
23. [Data Model Reference](#23-data-model-reference)
24. [Business Rules Reference](#24-business-rules-reference)
25. [Out of Scope — v1](#25-out-of-scope--v1)

---

## 1. Product Overview

FriendlyManager Events is the core event lifecycle management module for National Sports Organisations (NSOs) and their affiliated clubs. It covers the full journey from authoring an event through to post-event reporting: scheduling, invitee management, registration forms, fees, discounts, attendance, and communications.

### Problem Statement

Sports organisations currently manage events across disconnected tools — spreadsheets, third-party ticketing platforms, physical booking logs, and accounting software. This creates manual reconciliation overhead, data silos, and a fragmented experience for participants.

The Events module replaces this patchwork with a single, integrated flow that handles every event type a sports club runs, from a 15-minute committee meeting to a week-long holiday camp.

### Design Principles

1. **Inheritance over repetition** — defaults cascade NSO → Category → Event → Session; users configure exceptions, not rules.
2. **Guard rails, not gates** — warn before blocking; allow admin overrides with intentional friction (password confirmation), not hard locks.
3. **Real-time state** — capacity counts, waitlist positions, and payment statuses always reflect live data.
4. **Audit everything** — every state change is logged with full context.
5. **Mobile where it matters** — attendance, scan, and basic-event authoring are first-class on mobile; complex wizard authoring is desktop-only.

### Success Criteria

| # | Criterion |
|---|-----------|
| 1 | NSO admin can author a master event and share it to 10+ clubs in under 15 minutes, with Xero-code compliance enforced before any club can publish. |
| 2 | Club member can complete the full registration flow — session selection, sibling registration, discount application, payment — without contacting staff. |
| 3 | Zero double-bookings reach published state without an explicit admin password override. |
| 4 | Attendance reports are available in real time during a session, with bulk-action toolbar. |
| 5 | Public registrant with no FM account can complete registration and payment in under 5 minutes. |

---

## 2. Users & Personas

### NSO Admin
National Sports Organisation administrator. Authors master events, sets financial defaults, distributes events to affiliated clubs, requires consolidated cross-club reporting.

- **Goals:** Author once, distribute to many. Enforce fee compliance. See rolled-up data.
- **Pain points:** Clubs override pricing incorrectly. Xero codes are inconsistent. No single cross-club view.

### Club Admin / Event Coordinator
Runs day-to-day event operations for a single club. Accepts shared events, creates club-specific events, manages attendees and finances.

- **Goals:** Fast event setup. Override what needs overriding without breaking NSO defaults. Mobile access for simple events.
- **Pain points:** Multi-step fee config is complex. Conflict detection on venues is manual. Registration status scattered.

### Coach / Session Lead
Runs individual sessions, takes attendance.

- **Goals:** Fast attendance capture on mobile. Clear view of who should be at each session.
- **Pain points:** Attendee lists don't update when group membership changes. No mobile-friendly attendance UI.

### Member (Parent / Player)
Registers self or children for events, pays fees, tracks attendance.

- **Goals:** Clear pricing upfront. Stable registration link. Visible waitlist position. Single flow for multiple family members.
- **Pain points:** Surprise fees at checkout. Unclear hold-spot expiry. No auto-applied sibling discount.

### Public Registrant
Non-member registering via a public URL.

- **Goals:** Complete registration without creating an account. Clear pricing. Confirmation on payment.
- **Pain points:** Forced account creation before seeing pricing. No live capacity indicator.

### Finance Admin
Reconciles payments, manages refunds, maps fee components to Xero codes.

- **Goals:** Accurate Xero codes per fee component. Automated invoice sync. Clear refund audit trail.
- **Pain points:** Clubs publish events with unmapped fees. Out-of-system refunds break reconciliation.

---

## 3. Event Styles

The system supports seven event styles. All share the same `events` database table; style drives which creation flow and which detail-page tabs are available.

| Style | Code | Creation Flow | Description | Mobile Authoring |
|-------|------|---------------|-------------|-----------------|
| Basic | `BASIC` | Single-page form | Quick events — training sessions, committee meetings | Yes |
| Advanced | `ADVANCED` | 6-step wizard | Complex events with fees, forms, tickets, discounts | No |
| Multi-Session | `MULTI_SESSION` | Dedicated multi-session creator | Holiday programmes — sessions generated from templates across a date range | No |
| Sports Competition | `SPORTS_COMPETITION` | Advanced wizard | Competition entries with heats and draws | No |
| Holiday Program / Camp | `HOLIDAY_PROGRAM` | Advanced wizard + day/session grid | Multi-day programs with electives and sub-sessions | No |
| Attendance / Class | `ATTENDANCE` | Basic flow | Regular classes with recurring attendance tracking | Yes |
| Competition | `COMPETITION` | Advanced wizard | League/tournament structures | No |

### Event Status Lifecycle

```
DRAFT → PUBLISHED → CANCELLED
  ↓                    ↓
ARCHIVED           ARCHIVED
```

| Status | Badge colour | Description |
|--------|-------------|-------------|
| `DRAFT` | Grey | Created but not visible to members. Can be edited freely. |
| `PUBLISHED` | Green | Live — visible to invited members. Can be scheduled for future publication. |
| `CANCELLED` | Red | No new registrations. Existing registrants notified. |
| `ARCHIVED` | Amber | Hidden from all views. Data retained. |

---

## 4. Screen Map & URLs

All routes are under `/events`. The app is a Nuxt 3 SPA with Supabase as the backend.

### List & Creation Routes

| Screen | URL | Auth Required | Notes |
|--------|-----|---------------|-------|
| Event list / calendar | `/events` | Yes | Default view is calendar |
| Create Basic Event | `/events/new-basic` | Yes | Query params: `?name=`, `?date=`, `?endDate=`, `?wizard=1` |
| Create Advanced Event (wizard) | `/events/new-advanced` | Yes | Query params: `?name=`, `?date=`, `?endDate=` |
| Create Multi-Session Event | `/events/new-multi` | Yes | Query params: `?name=`, `?date=`, `?endDate=` |
| Create event (simple form) | `/events/new` | Yes | Legacy/non-wizard path; also used with `?prefill=1` for AI-prefilled |

### Event Detail Routes

All detail routes follow `/events/[id]`. Tab is selected via `?tab=` query param.

| Tab | URL | Available For |
|-----|-----|---------------|
| Overview | `/events/[id]` or `/events/[id]?tab=overview` | All styles |
| Sessions | `/events/[id]?tab=sessions` | Advanced, Multi-Session, Holiday Program |
| Discounts | `/events/[id]?tab=discounts` | Advanced, Multi-Session |
| Tickets | `/events/[id]?tab=tickets` | Advanced (only when Tickets toggle is on) |
| Forms | `/events/[id]?tab=forms` | Advanced, Multi-Session |
| Invitees | `/events/[id]?tab=invitees` | All styles |
| Communication | `/events/[id]?tab=communication` | All styles |
| Automation | `/events/[id]?tab=automation` | Advanced, Multi-Session |
| Attendance | `/events/[id]?tab=attendance` | All styles |
| Reporting | `/events/[id]?tab=reporting` | Advanced, Multi-Session |
| Notes & Tasks | `/events/[id]?tab=notes` | All styles |
| Settings | `/events/[id]?tab=settings` | Basic (capacity, visibility, permissions, sign-up window) |

**Tab availability by style:**

| Tab | BASIC | ADVANCED | MULTI_SESSION | Other |
|-----|-------|----------|---------------|-------|
| Overview | ✓ | ✓ | ✓ | ✓ |
| Sessions | — | ✓ | ✓ | ✓ |
| Discounts | — | ✓ | ✓ | ✓ |
| Tickets | — | ✓ (toggle) | — | — |
| Forms | — | ✓ | ✓ | ✓ |
| Invitees | ✓ | ✓ | ✓ | ✓ |
| Communication | ✓ | ✓ | ✓ | ✓ |
| Automation | — | ✓ | ✓ | — |
| Attendance | ✓ | ✓ | ✓ | ✓ |
| Reporting | — | ✓ | ✓ | ✓ |
| Notes & Tasks | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | — | — | — |

---

## 5. Feature: Event List & Calendar

**URL:** `/events`

### Description

The Events index is the home screen for all event management. It supports two view modes: Calendar (FullCalendar) and List (data table).

### Views

#### Calendar View (default)

- Powered by **FullCalendar** (day-grid and time-grid plugins).
- Header toolbar is hidden — navigation is handled by custom prev/next/today buttons in the page header.
- Clicking a date or dragging across a date range opens the "Create new event" flow pre-filled with those dates.
- Events are coloured by one of three modes: **Category colour** (default), **Status**, or **Style** — user-configurable in Calendar Settings.
- Sessions with `show_as_separate_event = true` are displayed as individual calendar entries (not nested under their parent event pill).
- **Hover tooltip:** Hovering an event pill after a 200ms delay shows a rich popup card (300ms dismissal debounce) containing: banner image or category colour bar, title, date/time range, location/meeting link, category badge, description excerpt, and status badge. The card flips left if near the right edge.
- **Scroll to navigate:** Mouse wheel on the month view nudges the calendar forward/back by one week (50ms debounce, minimum 50px scroll delta).
- **Search:** Text field in the header dims non-matching events to 15% opacity; hovering a dimmed event brings it to 50%.
- **Day max events:** 3 events shown per day cell; "+N more" overflow link expands.

#### List View

- DataTable with columns: Event (title + category chip), Style (Tag), Date (formatted with time), Status (coloured Tag).
- Row click navigates to the event detail page.
- Row ellipsis menu: View, Publish (if DRAFT), Archive.
- Sorted by `start_at` ascending, nulls last.

### Header Controls

| Control | Behaviour |
|---------|-----------|
| View toggle (Calendar / List) | SelectButton; switches view mode |
| Prev / Next / Today | Navigate the calendar; hidden in list view |
| Month label | Shows current month/year; auto-updates on navigation |
| Search | Filters both calendar and list views |
| Calendar Settings (sliders icon) | Opens Calendar Settings dialog |
| New Event (blue button) | Opens the event name prompt, then the event type picker |

### Event Type Picker Flow

1. **Step 1 — Event Name modal:** User types the event name and presses Enter or "Next". The name pre-fills the creation form.
2. **Step 2 — Event Type picker:** Three cards: Basic Event, Multi Session, Advanced Event.
   - Optional "Use step-by-step wizard" checkbox (default: checked). When unchecked, Advanced goes to `/events/new` instead of `/events/new-advanced`.
3. Clicking a card navigates to the appropriate creation route with name and date query params.

### Calendar Settings Dialog

Opens at: `/events` with the Calendar Settings dialog visible.

| Setting | Options | Persisted |
|---------|---------|-----------|
| Colour events by | Category / Status / Style | Yes, per calendar |
| Default view | Month / Week / Day | Yes, per calendar |
| Week starts on | Sunday / Monday | Yes, per calendar |
| Show weekends | Toggle | Yes, per calendar |
| Categories (visibility checkboxes) | One per category with colour dot | Yes, per calendar |
| Show uncategorised events | Toggle | Yes, per calendar |

**Persistence:** Settings are saved to `localStorage` under key `fm_cal_prefs_v1`, keyed by calendar ID (or `"all"` when no named calendar is active). Each named calendar has independent settings. Reset clears the stored prefs for the current calendar.

**Calendar editing:** When viewing a named calendar (`?calendar=<id>`), the settings dialog loads that calendar's name and assigned categories for editing. Save updates the calendar record and its category assignments via the `calendar_categories` join table. Delete prompts for confirmation, then removes the calendar record and redirects to `/events`.

### Named Calendars (Sidebar)

Named calendars group events by category. When a named calendar is active (selected in the sidebar), the Calendar Settings dialog shows only the categories assigned to that calendar. On first visit to a named calendar, the visible category filter is pre-seeded from the calendar's assigned categories.

### Demo Data Prompt

On first load when no events exist and the user hasn't previously dismissed the prompt, a "Welcome to FriendlyManager!" dialog offers to install demo data:

- **Install Demo Data:** Creates 3 categories (Swim Training, Competitions, Social Events) and 4 events (Swim Squad Training, Junior Development Training, Regional Championships, End of Season Dinner).
- **Start Fresh:** Dismisses and stores `fm_demo_data_prompted_v1` in localStorage to prevent re-prompting.

### User Stories

**EVENTS-001** — As a Club Admin, I want to view all events in a monthly calendar so that I can see at a glance what's scheduled and when.

**Acceptance criteria:**
- Events display in their category colour by default.
- Hovering an event shows a tooltip with title, date, time, location, category, and status.
- Clicking an event navigates to its detail page.
- Navigation controls (prev/next/today) are visible at all times.
- The month label updates as I navigate.

**EVENTS-002** — As a Club Admin, I want to switch between calendar and list views so that I can choose the format that suits my current task.

**Acceptance criteria:**
- A toggle in the header switches between Calendar and List views instantly.
- Both views apply the same search filter.
- The list view is sortable and shows event style, date range, and status.

---

## 6. Feature: Create Basic Event

**URL:** `/events/new-basic`  
**Query params:** `?name=<prefilled title>`, `?date=<YYYY-MM-DD>`, `?endDate=<YYYY-MM-DD>`, `?wizard=1`

### Description

A single-page form for quickly creating simple events. Available on mobile and desktop. When `?wizard=1`, the desktop layout shows all sections at once; the mobile layout steps through them one at a time with a progress bar.

### Sections

#### Event Info
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Event Title | Text | Yes | Pre-fills from `?name=` query param |
| Description | Rich text (TipTap) | No | Supports headings, bullets, links |
| Category | MultiSelect with colour chips | No | Can add new category inline |
| Discipline | Select | No | Clear-able |

#### Date & Sign Up
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Start date | DatePicker | No | Pre-fills from `?date=` |
| End date | DatePicker | No | Pre-fills from `?endDate=` |
| Start time / End time | TimePicker | No | Hidden when All Day is on |
| All Day | Toggle | No | Hides time fields |
| Repeat | Select | No | None / Daily / Weekly / Monthly / Custom |
| Sign-up opens | DateTimePicker | No | |
| Sign-up closes | DateTimePicker | No | |

#### Location
Three mutually exclusive modes:
1. **FM Bookable** — selector for registered venue bookables.
2. **Address** — free-text with Google Places autocomplete; shows venue name + address fields.
3. **Online** — reveals meeting link field.

Multiple locations can be added (e.g., different rooms).

#### Invitees
Inline invitee selector. Supports: individuals, system groups, roles, tags, disciplines, and dynamic filter expressions.

### Mobile Wizard Steps

| Step | Label |
|------|-------|
| 0 | Event Info |
| 1 | Date & Sign Up |
| 2 | Location |
| 3 | Invitees |

Progress bar across the top reflects current step. Back button on step 0 returns to `/events`.

### Actions

| Button | Behaviour |
|--------|-----------|
| Cancel | Navigates back to `/events` |
| Save Event | Validates title is non-empty, saves with `status: DRAFT`, navigates to event detail |

### Rules

- Event is created in `DRAFT` state; admin must publish explicitly.
- Title is the only required field; form cannot submit without it.
- If no category is selected, the event is treated as uncategorised.
- Date params passed via query string pre-fill the date fields but do not prevent editing.

### User Stories

**EVENTS-003** — As a Club Admin, I want to create a basic event using a minimal form so that I can quickly set up simple events like training sessions.

**Acceptance criteria:**
- Single-page creation form (or stepped on mobile) with: title, description, category, dates, location, and invitees.
- Location supports FM Bookable, free-text address, and Online modes.
- Event is saved in Draft state.
- Basic Event authoring works on mobile with a step-by-step wizard.
- Created event appears in the event list and calendar immediately.

---

## 7. Feature: Create Advanced Event

**URL:** `/events/new-advanced`  
**Query params:** `?name=`, `?date=`, `?endDate=`

### Description

A 6-step wizard for creating complex events with full configuration: fees, registration forms, capacity rules, public visibility, and phased access. Desktop-only (not responsive for mobile authoring).

### Wizard Steps

#### Step 1 — Event Info

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Event Title | Text | Yes | |
| Description | Rich text | No | |
| Category | MultiSelect + Add button | No | |
| Discipline | Select | No | |
| Banner Image | Image upload | No | 1200×350 recommended; uploaded to Supabase Storage |

#### Step 2 — Date & Time

| Field | Type | Notes |
|-------|------|-------|
| Start date + time | DatePicker + TimePicker | |
| End date + time | DatePicker + TimePicker | |
| All Day toggle | Toggle | Hides time pickers |
| Recurrence | Select (None / Weekly / Monthly / Annual / Custom) | Custom opens a rule builder |

#### Step 3 — Location

Same three-mode location selector as Basic Event. Multiple locations supported.

#### Step 4 — Capacity & Sign Up

| Field | Type | Notes |
|-------|------|-------|
| Capacity limit toggle | Toggle | Off = unlimited |
| Max attendees | Number | Shown when capacity is on |
| Waitlist | Toggle | Auto-promotes when a spot opens |
| Sign-up opens | DateTimePicker | |
| Sign-up closes | DateTimePicker | |
| Hold-spot | Toggle | Reserves spots pending parent confirmation (24h window) |
| Phased registration | Toggle | Members get early access; public opens at configured date |
| Member window days | Number | Days before event that members get access (default: 40) |
| Public opens at | DateTimePicker | Optional override |

#### Step 5 — Visibility

| Field | Type | Notes |
|-------|------|-------|
| Public event | Toggle | Generates a public URL; visible to non-members |
| Featured event | Toggle | Highlighted in event list and member dashboard |
| Show attendee list | Toggle | Members can see the full attendee list |
| Show attendee count | Toggle | Members can see total registrant count |
| Allow expressions of interest | Toggle | Members can indicate interest before registration opens |

#### Step 6 — Fees

Fee components (Kit, Qualification, NSO, Club), each with:
- Amount
- Xero code
- Lock/editable flag (for NSO-shared events)

### Navigation Rules

- User can click back to any previously completed step.
- Clicking forward requires the current step to have a valid state (at minimum, title on step 1).
- "Save draft" button in the header is always available; saves the event in DRAFT state and navigates to the event detail page.
- Completing the final step shows a "Publish" / "Save as Draft" option.

### User Stories

**EVENTS-004** — As a Club Admin, I want to create an Advanced Event using a multi-step wizard so that I can configure complex rules, fees, and public visibility.

**Acceptance criteria:**
- Multi-step wizard with clearly labelled steps: Event Info → Date & Time → Location → Capacity & Sign Up → Visibility → Fees.
- Each step validates before advancing; user can navigate back without losing progress.
- Rich-text description editor supports headings, bullets, and links.
- Banner image upload supported; image is stored and displayed in the event detail hero.
- Advanced Event authoring is desktop-only.
- "Save draft" is available at all times.

---

## 8. Feature: Create Multi-Session Event

**URL:** `/events/new-multi`  
**Query params:** `?name=`, `?date=`, `?endDate=`

### Description

Creates a Multi-Session Event by defining session templates that are automatically expanded into individual session records across a date range. Ideal for holiday programmes where the same schedule repeats each day.

### Sections

#### Event Details

| Field | Required | Notes |
|-------|----------|-------|
| Event Name | Yes | |
| Age Limit (min, max) | No | In years |

#### Dates

| Field | Required | Notes |
|-------|----------|-------|
| Programme start date | Yes | |
| Programme end date | Yes | |
| Include weekends | No | Default: unchecked |
| Exclude public holidays | No | Default: unchecked |

After selecting dates, a preview shows the total number of session days generated.

#### Session Templates

Each template defines a session type (e.g., "Morning Session", "Afternoon Session") that repeats on every selected day. Per template:

| Field | Notes |
|-------|-------|
| Name | Session type label |
| Start time | Shared across all days |
| End time | |
| Location | FM Bookable or address |
| Capacity (max) | Per-session capacity |
| Fee | Per-session fee |
| Eligible invitee rules | JSON expression |
| Required / Optional | Required = all registrants; Optional = selected at registration |

Multiple templates can be added to one event.

### Session Generation Logic

When the event is saved, the system generates one `sessions` record per template per day in the date range, respecting:
- Weekend inclusion/exclusion
- Public holiday exclusion
- `parent_session_id` is null (top-level sessions)
- Sessions are ordered by day then by template sort order

### Rules

- At least one session template is required to create the event.
- The date range must have at least one valid day after applying weekend/holiday exclusions.
- The day count preview updates reactively as dates and options change.

### User Stories

**EVENTS-005** — As a Club Admin, I want to create a Multi-Session Event so that I can run programmes where sessions repeat across multiple days.

**Acceptance criteria:**
- Wizard includes a date range selector with weekend/holiday exclusion options.
- A preview shows the number of session days before saving.
- Session templates define a repeating schedule; saving generates individual session records.
- Sessions can be marked Required or Optional.
- Parent event and session capacities are tracked independently.

---

## 9. Feature: Event Detail — Overview Tab

**URL:** `/events/[id]?tab=overview`

### Description

The primary view for an event. Shows all key event details with inline editing. Serves as both the admin view and the template for the member-facing event page.

### Layout

#### Tab Navigation Bar

Pill-shaped navigation buttons across the top of the page. Active tab has dark navy (`#1E2157`) fill. Tabs available depend on event style (see Section 4).

#### Actions Row (below tab bar)

| Element | Behaviour |
|---------|-----------|
| Status Tag | Coloured badge showing current status |
| Publish button | Green "Publish" button for DRAFT events; opens Publish dialog |
| Scheduled button | Amber "Scheduled" button if `publish_at` is set |
| Ellipsis menu | Duplicate, Archive, Delete, and other event-level actions |

#### Hero Banner

- **Height:** 300px
- **Background:** Banner image if uploaded; otherwise a navy-to-blue gradient.
- **Inline edit:** Clicking the banner triggers a file picker. Upload progress is shown as an overlay. Image is stored in Supabase Storage and the URL is saved to `events.banner_url`.
- **Title bar:** Overlaid at the bottom of the banner (dark translucent strip). Title is an inline-editable `<input>` — clicking focuses it; blurring saves the change to the database. Pressing Enter blurs.
- **Date badge:** Floating white card in the bottom-right showing day abbreviation, day number, and month abbreviation of the event start date.

#### Attendee Summary Row

Shows: Confirmed count (green badge), Interested count, Waitlisted count (if waitlist enabled), capacity indicator ("of X capacity"). "Take Attendance" button navigates to the Attendance tab.

#### Info Card (Inline-Editable Fields)

Each field row follows the pattern: label (fixed 112px width) | value | edit pencil icon on hover. Clicking any row opens an inline edit form beneath it; clicking "Save" or pressing Enter commits; "Cancel" reverts.

| Field | Inline editable | Notes |
|-------|----------------|-------|
| Name | Yes | Hidden for ADVANCED style (title lives in the banner) |
| Date | Yes (via EventDetailsCard component) | Start/end date, start/end time, all-day toggle |
| Repeat | Yes | Recurrence rule |
| Location | Yes | All three location modes |
| Category | Yes | MultiSelect with colour chips |
| Description | Yes | Rich text |
| Fee / Registration | Yes | Fee line items and registration open/close dates |

#### Ticketed Event Toggle (Advanced only)

A toggle row that enables/disables the Tickets tab. When on: "Tickets enabled — Tickets tab is active." When off: "No tickets for this event."

### Publish Dialog

Opened via the Publish button. Contains:

| Option | Type | Notes |
|--------|------|-------|
| Send invitation to invitees | Checkbox | Triggers email send on publish |
| Post to website / public URL | Checkbox | Makes the event externally visible |
| Schedule for later | Checkbox | Reveals date + time pickers for `publish_at` |

Confirming sets `status = PUBLISHED` (or saves `publish_at` for scheduled publishing) and optionally sends invitations.

---

## 10. Feature: Event Detail — Sessions Tab

**URL:** `/events/[id]?tab=sessions`

### Description

Lists and manages all sessions and sub-sessions for Advanced and Multi-Session events. Sessions are edited in a split-pane layout: session list on the left, session editor on the right.

### Session List

- Flat list for events with few sessions; grouped by day for Multi-Session events.
- Each row shows: session title, date/time, location summary, capacity indicator, status chip.
- Clicking a session opens it in the Session Editor pane.
- "Add session" button creates a blank session.

### Session Editor (`<SessionEditor>` component)

Per-session configuration with its own tab bar:

| Sub-tab | Contents |
|---------|----------|
| Details | Title, start/end, location, description, bookable assignment |
| Invitees | Per-session invitee overrides and eligibility rules |
| Capacity | Per-session capacity min/max, waitlist |
| Attendance | Session-level attendance list (also accessible from the Attendance tab) |

### Direct Navigation to a Session

URL: `/events/[id]?tab=sessions&sessionId=<sessionId>` — opens the Sessions tab with the specified session pre-selected in the editor.

### Session Fields

| Field | Inherited from Event | Can Override |
|-------|---------------------|-------------|
| Title | No | — |
| Start / End | Yes | Yes |
| Location | Yes | Yes |
| Capacity | Yes | Yes |
| Invitee eligibility | Yes | Yes |
| Access profile | Yes | Yes |
| Lighting profile | Yes | Yes |
| Required / Optional | No (default: Required) | — |

### Clicking "Take Attendance" in the Session Editor

Navigates to `/events/[id]?tab=attendance` and pre-selects that session in the attendance panel.

---

## 11. Feature: Event Detail — Invitees Tab

**URL:** `/events/[id]?tab=invitees`

### Description

Full invitee management. Rendered by the `<EventInviteeManager>` component.

### Invitee Statuses

| Status | Description | Auto-set | Admin-settable |
|--------|-------------|----------|---------------|
| `INVITED` | Person has been added to the event | On add | Yes |
| `CONFIRMED` | Person has confirmed attendance or completed registration | On registration | Yes |
| `DECLINED` | Person has declined | On decline | Yes |
| `EXCLUDED` | Removed from the event | — | Yes |
| `INTERESTED` | Expressed interest before registration opens | On interest click | Yes |
| `HOLD` | Spot reserved pending parent/guardian confirmation (24h) | On child registration | Yes |
| `WAITLISTED` | Confirmed list is full; queued for promotion | When capacity is reached | Yes |

### Invitee Controls

Configurable toggles (also in Settings tab):

| Toggle | Effect |
|--------|--------|
| Allow members to see full attendee list | Members can see names |
| Allow members to see attendee count only | Members see a count but not names |
| Allow Interested / Going responses | Members can mark interest |
| Allow guests | Enables a max-guests-per-invitee field |

### Adding Invitees (FM Selector)

A modal/drawer that supports selecting invitees by:
- Individual person lookup
- System group (team, class)
- Permission role
- Job
- Tag
- Discipline
- Dynamic filter expression (e.g. `Gender = Female AND Age BETWEEN 12 AND 18`)

When attaching a group:
- **Live link:** Group membership changes are auto-reflected (new members are auto-invited).
- **Snapshot:** Point-in-time copy; group changes do not affect the invitee list.

### Bulk Actions

Multi-select checkboxes on invitee rows. Bulk action toolbar appears when rows are selected:

| Action | Description |
|--------|-------------|
| Set Status | Bulk-set all selected to a chosen status |
| Send Message | Trigger a communication to selected invitees |
| Remove | Remove selected invitees |

### Status History

Each invitee record has a status history log. Clicking an invitee row opens a detail panel showing: current status, status history with timestamps and actor, registration date, fee paid, sessions confirmed.

---

## 12. Feature: Event Detail — Forms Tab

**URL:** `/events/[id]?tab=forms`

### Description

Drag-and-drop registration form builder. Forms are configured per invitee group, allowing different audiences to see different fields.

### Layout

Split-pane: left panel (form group list / section nav) | right panel (form preview / field editor).

### Form Groups

Each invitee group can have its own registration form. The group list shows:

| Indicator | Meaning |
|-----------|---------|
| Green check | All sections complete |
| Red exclamation | Some sections incomplete |
| Grey plus circle | Not set up yet |
| Orange ban | Group has no registrations (form not needed) |

A progress fraction (`N of M sections saved`) is shown for in-progress forms.

### Form Sections

After selecting a group, the left panel switches to a section navigator. Standard sections include:

- **Details** — core personal fields (name, DOB, email, phone, emergency contact)
- **Advanced** — custom fields, dietary requirements, medical notes
- **Existing Fields** — reuse fields already configured on another form in the org
- **Create New** — block picker to add new field types

### Field Types (Block Picker)

| Category | Field types |
|----------|-------------|
| Text | Short text, Long text, Rich text |
| Choice | Single select, Multi select, Checkbox, Radio |
| Date/Time | Date, Time, Date range |
| Personal | Name, DOB, Gender, Address, Phone, Email |
| Media | File upload, Signature |
| Payment | Fee summary, Discount code entry |
| Sessions | Session picker (date-table or grouped layout) |

### Session Picker Layouts

For multi-session events, the session selection field can be displayed as:
- **Date Table** — sessions grouped by date (rows) and session type (columns); ideal for multi-day programmes.
- **Grouped by Date** — clickable date headers expand to show sessions beneath.

### Form Design Settings

| Setting | Options |
|---------|---------|
| Layout style | Tabs / Single page |
| Sessions layout | Date Table / Grouped by date |
| Custom CSS | (Advanced) |

### Order Preview

The right panel shows a live preview of the registration order as it would appear to a registrant, including:
- Per-person fee rows
- Session selections
- Discount rows
- Total amount

---

## 13. Feature: Event Detail — Discounts Tab

**URL:** `/events/[id]?tab=discounts`

### Description

Manage discount codes and automatic discount rules for the event.

### Discount Table Columns

| Column | Description |
|--------|-------------|
| Name | Discount label shown to registrants |
| Type | Code-based / Sibling / Role-based / Training-linked |
| Amount | Flat or percentage |
| Conditions | Rule expression (e.g. `Role = Coach`) |
| Redeemed | Count of successful redemptions |
| Cap | Max redemptions (blank = unlimited) |
| Expiry | Date after which the code is inactive |
| Actions | Edit / Delete |

### Discount Types

| Type | Description |
|------|-------------|
| **Code-based** | Registrant enters a promo code at checkout. Cap and expiry configurable. |
| **Sibling** | Auto-applied when multiple family members register for the same event. |
| **Role-based** | Auto-applied based on the registrant's FM role (e.g., Coach, Volunteer). |
| **Training-linked** | Auto-applied when the registrant has a linked training record or qualification. |

### Rules

- Multiple discounts can be active simultaneously.
- Evaluation order is configurable (drag to reorder).
- A discount that reduces total to below $0 is capped at $0.
- Code-based discounts track `redeem_count` in real time.

---

## 14. Feature: Event Detail — Tickets Tab

**URL:** `/events/[id]?tab=tickets`  
**Availability:** Advanced events only, when the "Ticketed Event" toggle on the Overview tab is enabled.

### Description

Manages ticket types, quantities, and pricing tiers for events that sell tickets to the public.

### Ticket Fields

| Field | Notes |
|-------|-------|
| Ticket name | e.g., "General Admission", "VIP" |
| Description | Short description shown at checkout |
| Price | Per-ticket amount |
| Quantity available | Capacity for this ticket type |
| Sale opens / closes | Date range for this ticket type |
| Visibility | Public / Members only |
| Linked fee component | Maps to a Xero code |

### Rules

- Tickets are independent of the invitee registration flow — a person can purchase a ticket without being on the invitee list.
- When tickets are enabled, the registration form gains a ticket-selection step.
- Ticket sales and registration statuses are tracked separately.

---

## 15. Feature: Event Detail — Communication Tab

**URL:** `/events/[id]?tab=communication`

### Description

Send and track communications (emails) to invitee subsets from within the event.

### Layout

Two tables on the Communication tab:
1. **Sent communications** — log of all manual sends with: date, subject, audience, sent count, delivery status summary.
2. **Automated communications** — list of trigger-based messages configured in the Automation tab.

### Audience Selector

When composing a new communication, the audience can be sliced by:
- Invitee group
- Invitee status (e.g., only Confirmed)
- Sub-group
- Session attendance
- Boolean combinations (e.g., Confirmed AND Session = Morning)

### Compose Flow

1. Select audience.
2. Choose or create a template (FM Mailer).
3. Preview the rendered email with live data.
4. Send immediately or schedule.

### Delivery Tracking

Each send logs: recipient, sent timestamp, opened (boolean), failed (boolean). Viewable per-send from the sent log.

---

## 16. Feature: Event Detail — Automation Tab

**URL:** `/events/[id]?tab=automation`

### Description

Configure event-triggered automations — primarily automated communications at key registration milestones.

### Built-in Automation Triggers

| Trigger | Default action | Configurable |
|---------|---------------|-------------|
| Registrant added (Invited) | Send invitation email | Yes |
| Hold created | Send hold confirmation to registrant | Yes |
| Hold expiring soon (e.g., 2h before 24h deadline) | Send reminder to parent/guardian | Yes |
| Hold expired without confirmation | Notify registrant; release spot | Yes |
| Payment due | Send payment reminder | Yes |
| Waitlist position available | Notify waitlisted registrant | Yes |
| Refund window closing | Notify confirmed registrants | Yes |
| Attendance confirmed | Send "See you there" email | Yes |

### Automation Record Fields

| Field | Notes |
|-------|-------|
| Trigger | From the list above |
| Delay | e.g., "2 hours before", "Immediately" |
| Audience filter | Status, group, session |
| Template | FM Mailer template |
| Active toggle | Enable/disable without deleting |

---

## 17. Feature: Event Detail — Attendance Tab

**URL:** `/events/[id]?tab=attendance`

### Description

Record actual physical attendance per session. Designed to be fast and fully functional on mobile.

### Layout

Split view (collapsible on mobile):
- **Left panel:** Session selector. Lists all sessions for the event. Clicking a session loads its attendance list. Can be pre-selected via query param `?tab=attendance&sessionId=<id>`.
- **Right panel:** Attendance table for the selected session.

### Attendance Table Columns

| Column | Notes |
|--------|-------|
| Name | Person's full name |
| Registration status | Their invitee status (Confirmed, etc.) |
| Attended | Toggle (Yes / No) — large touch target for mobile |
| Notes | Optional per-person attendance note |

### Bulk Actions

- **Mark all present** — sets all rows to Attended = Yes.
- **Multi-select** — select subset, then: Message, Add to Waitlist, Refund, Tag.

### Required Minimum Logic

For events with a minimum attendance requirement (e.g., "must attend 4 of 5 days"), the system:
- Tracks the count of attended sessions per person across the event.
- Flags registrants at the end of the event who haven't met the minimum.
- Shows a warning indicator next to flagged registrants in the Attendance tab.

### Rules

- Attendance is tracked separately from registration intention ("is coming?" vs. physically present).
- Attendance data is available in real time during a session.
- The Coach / Session Lead role has access to this tab even without broader admin permissions.

---

## 18. Feature: Event Detail — Reporting Tab

**URL:** `/events/[id]?tab=reporting`

### Description

Event-specific reports without navigating to the main Reporting module.

### Reports Available

| Report | Description |
|--------|-------------|
| Attendance by session | Attended count and % per session |
| Attendance by person | Each registrant's session attendance record |
| Attendance by group | Aggregate by invitee group |
| Attendance by category | Cross-event comparison by category |
| Registration funnel | Views → Interest → Hold → Confirmed → Paid → Attended (with drop-off % at each step) |
| Waitlist conversion rate | % of waitlisted who converted to Confirmed |
| Drop-off rate | % who dropped between stages |
| Refund rate | Refunds issued as % of total registrations |

### Export

All report data is exportable to CSV and XLSX from the tab toolbar.

### Scheduled Reports

Reports can be scheduled for email delivery. Clicking "Schedule" on a report opens the Reporting module scheduler.

---

## 19. Feature: Event Detail — Notes & Tasks Tab

**URL:** `/events/[id]?tab=notes`

### Description

Internal notes and action items attached to the event. Visible only to admins.

### Notes

Free-form notes with an optional title and rich-text content. Stored in the `event_notes` table.

| Field | Notes |
|-------|-------|
| Title | Optional |
| Content | Rich text |
| Created at | Auto-set; displayed in the note list |

Notes are listed chronologically. Clicking a note opens it for inline editing. Delete is available on each note.

### Tasks

Tasks linked to the event. Each task has:

| Field | Notes |
|-------|-------|
| Title | Required |
| Description | Optional |
| Due date | Shown with overdue warning if past |
| Assignee | FM user (picks from org members) |
| Linked person | Optional — links task to a specific registrant |
| Status | Open / In Progress / Done |
| Role | Optional role tag for the task |

Tasks appear on the assignee's FM dashboard. Overdue tasks are visually flagged in the tab. Tasks can be filtered by status and assignee.

---

## 20. Feature: Event Settings Tab

**URL:** `/events/[id]?tab=settings`  
**Availability:** Basic events only

### Description

For Basic events, the Settings tab surfaces configuration options that Advanced events expose inline via dedicated tabs. It is the equivalent of a lightweight admin panel for simple events.

### Sections

#### Capacity

| Setting | Type | Notes |
|---------|------|-------|
| Capacity limit | Toggle | Off = unlimited |
| Max attendees | Number | Visible when capacity is on |
| Waitlist | Toggle | Auto-promotes when a spot opens |

#### Visibility & Access

| Setting | Type | Notes |
|---------|------|-------|
| Public event | Toggle | Visible to anyone, not just members |
| Featured event | Toggle | Highlighted in event list |

#### Permissions

| Setting | Type | Notes |
|---------|------|-------|
| Show attendee list | Toggle | Registered members can see who else is attending |
| Show attendee count | Toggle | Display total registration count publicly |
| Allow expressions of interest | Toggle | Members can mark interest before registration |
| Hold-spot registration | Toggle | Members can hold a spot pending confirmation |

#### Sign Up Window

| Setting | Type | Notes |
|---------|------|-------|
| Opens | DateTimePicker | Optional; no restriction if blank |
| Closes | DateTimePicker | Optional; no restriction if blank |

#### Registration Window

| Setting | Type | Notes |
|---------|------|-------|
| Phased registration | Toggle | Members get early access before public |
| Member window (days before) | Number | How many days before the event members get access (default: 40) |
| Public opens at | DateTimePicker | Optional override of the calculated public date |

---

## 21. Feature: Categories

**URL (managed from):** `/settings` (Categories section)

### Description

Hierarchical taxonomy that carries default configuration for events. Categories provide the colour and icon shown on the calendar and in list views.

### Category Fields

| Field | Notes |
|-------|-------|
| Name | Display name |
| Colour | Hex colour for calendar and chips |
| Icon | PrimeIcons icon class |
| Parent category | For subcategories; inherits parent defaults unless overridden |
| Default T&Cs | Text block inherited by new events in this category |
| Default Xero codes | JSON map of fee component → Xero code |
| Default registration form | Form template applied to new events |
| Sort order | Display order in selectors and calendar settings |

### Rules

- Primary and secondary category can be assigned per event.
- Editing a category's defaults does not retroactively change existing events — only new events inherit updated defaults.
- A category can be used in the Named Calendar system to scope calendar views.

---

## 22. Feature: Named Calendars

**URL:** `/events?calendar=<id>`  
**Managed in:** Calendar Settings dialog (sliders icon in the event list header)

### Description

Admins can create named calendars that group events by category. Named calendars appear in the left sidebar of the Events page.

### Calendar Fields

| Field | Notes |
|-------|-------|
| Name | Display name (e.g., "Competition Season") |
| Assigned categories | MultiSelect; filters which events appear in this calendar |
| Sort order | Position in the sidebar |

### Rules

- When a named calendar is active, Calendar Settings shows only the categories in that calendar.
- Unassigning all categories from a calendar makes it behave like the "All Events" view.
- Each named calendar has independent settings in localStorage (colour mode, default view, week start, weekends, visible categories).
- Deleting a named calendar does not delete its events — it only removes the grouping.

---

## 23. Data Model Reference

### Core Tables

#### `organisations`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | text | |
| type | text | `NSO` or `CLUB` |
| parent_id | UUID | Self-referential; Club's parent is the NSO |
| slug | text | Unique URL slug |
| logo_url | text | |
| currency | text | Default: AUD |
| locale | text | Default: en-AU |

#### `categories`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| org_id | UUID | FK → organisations |
| parent_id | UUID | Self-referential for subcategories |
| name | text | |
| color | text | Hex |
| icon | text | PrimeIcons class |
| default_tc | text | Default T&Cs text |
| default_form_id | UUID | FK → forms |
| default_xero_codes | jsonb | Map of component → Xero code |
| sort_order | integer | |

#### `events`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| org_id | UUID | FK → organisations |
| title | text | Required |
| description | text | Rich text (HTML) |
| style | text | `BASIC`, `ADVANCED`, `MULTI_SESSION`, `SPORTS_COMPETITION`, `HOLIDAY_PROGRAM`, `ATTENDANCE`, `COMPETITION` |
| status | text | `DRAFT`, `PUBLISHED`, `CANCELLED`, `ARCHIVED` |
| category_id | UUID | FK → categories (primary) |
| secondary_category_id | UUID | FK → categories |
| start_at | timestamptz | |
| end_at | timestamptz | |
| is_all_day | boolean | |
| recurrence_rule | text | iCal RRULE string |
| recurrence_parent_id | UUID | FK → events (parent of recurring series) |
| location_type | text | `BOOKABLE`, `ADDRESS`, `ONLINE` |
| bookable_id | UUID | FK → bookables |
| address | text | |
| meeting_link | text | |
| capacity_min | integer | |
| capacity_max | integer | |
| show_attendee_list | boolean | Default: false |
| show_attendee_count | boolean | Default: true |
| allow_interest | boolean | Default: false |
| allow_guests | boolean | Default: false |
| max_guests_per_invitee | integer | |
| hold_spot_enabled | boolean | Default: false |
| hold_spot_age_max | integer | Min age to trigger hold-spot flow |
| phased_registration | boolean | Default: false |
| member_window_days | integer | Default: 40 |
| public_opens_at | timestamptz | |
| master_event_id | UUID | FK → events (NSO master) |
| sharing_config | jsonb | Per-component lock/editable flags |
| banner_url | text | |
| attachments | jsonb | Array of file metadata |
| tc_content | text | Terms & conditions (overrides category default) |
| is_featured | boolean | Default: false |
| is_public | boolean | Default: false |
| public_url_slug | text | Unique slug for public URL |
| form_id | UUID | FK → forms |
| xero_codes_locked | boolean | Default: false |
| publish_at | timestamptz | Scheduled publish time |
| reg_open_at | timestamptz | Sign-up window open |
| reg_close_at | timestamptz | Sign-up window close |
| has_waitlist | boolean | |
| has_capacity | boolean | |
| has_tickets | boolean | |
| created_by | UUID | FK → persons |

#### `sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| event_id | UUID | FK → events |
| parent_session_id | UUID | Self-referential; null = top-level session |
| title | text | |
| description | text | |
| start_at | timestamptz | |
| end_at | timestamptz | |
| is_all_day | boolean | |
| location_type | text | `BOOKABLE`, `ADDRESS`, `ONLINE` |
| bookable_id | UUID | FK → bookables |
| address | text | |
| meeting_link | text | |
| is_required | boolean | Default: true |
| capacity_min | integer | |
| capacity_max | integer | |
| visibility_rule | jsonb | Eligibility expression |
| restrictions | jsonb | Additional restrictions |
| access_profile_id | UUID | |
| lighting_profile_id | UUID | |
| sort_order | integer | |
| show_as_separate_event | boolean | Display as own calendar entry |

#### `invitees`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| event_id | UUID | FK → events |
| person_id | UUID | FK → persons |
| session_id | UUID | FK → sessions (null = event-level) |
| group_id | UUID | FK → invitee group |
| status | text | `INVITED`, `CONFIRMED`, `DECLINED`, `EXCLUDED`, `INTERESTED`, `HOLD`, `WAITLISTED` |
| hold_expires_at | timestamptz | 24h after hold was set |
| registered_at | timestamptz | |
| notes | text | |

#### `connection_groups`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| org_id | UUID | FK → organisations |
| name | text | |

#### `connection_group_events`

Join table: `group_id` × `event_id`.

#### `calendars`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| org_id | UUID | FK → organisations |
| name | text | |
| sort_order | integer | |

#### `calendar_categories`

Join table: `calendar_id` × `category_id`.

#### `event_notes`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| event_id | UUID | FK → events |
| title | text | Optional |
| content | text | Rich text |
| created_at | timestamptz | |

---

## 24. Business Rules Reference

### Creation & Status

| Rule | Detail |
|------|--------|
| BR-001 | All events are created in `DRAFT` status. |
| BR-002 | Publishing requires at minimum: title set, category set (for Advanced events). |
| BR-003 | Archiving soft-deletes — events are hidden from all views but data is retained. |
| BR-004 | Recurring event edits prompt scope selection: This occurrence / All future / All. |
| BR-005 | Events with `publish_at` set transition to PUBLISHED automatically at that timestamp. |

### Capacity & Waitlist

| Rule | Detail |
|------|--------|
| BR-010 | When `capacity_max` is reached, new registrants are placed in `WAITLISTED` status automatically. |
| BR-011 | When a CONFIRMED registrant cancels, the first WAITLISTED person is auto-promoted and notified. |
| BR-012 | Session capacity is tracked independently of event capacity. |
| BR-013 | The live capacity counter ("X of Y spots left") reflects real-time data. |
| BR-014 | Waitlist position is visible to the waitlisted registrant on the registration form. |

### Hold-Spot Flow

| Rule | Detail |
|------|--------|
| BR-020 | Hold-spot must be explicitly enabled per event (default: off). |
| BR-021 | When a registrant under `hold_spot_age_max` registers, status is set to `HOLD` and `hold_expires_at = now() + 24h`. |
| BR-022 | Parent/guardian email captured at registration receives a branded confirmation link. |
| BR-023 | If confirmed within 24h: status → CONFIRMED; payment flow triggered. |
| BR-024 | If not confirmed within 24h: spot released; status → WAITLISTED if event is full; registrant notified. |
| BR-025 | Admin can manually extend or cancel a hold from the invitee panel. |

### Phased Registration

| Rule | Detail |
|------|--------|
| BR-030 | Member-exclusive phase opens `member_window_days` before `start_at` (default: 40 days). |
| BR-031 | Public phase opens at `public_opens_at` or after the member window ends (whichever is later). |
| BR-032 | Non-qualifying registrants see a message explaining when they can register. |

### NSO → Club Sharing

| Rule | Detail |
|------|--------|
| BR-040 | NSO creates a master event; shares to selected clubs. |
| BR-041 | Club receives the event in "Pending Acceptance" state. |
| BR-042 | Club can override only fields the NSO has marked editable in `sharing_config`. |
| BR-043 | All fee components must have mapped Xero codes before a shared event can be published. |
| BR-044 | NSO reporting rolls up registrations and revenue across all club versions. |

### Invitee Management

| Rule | Detail |
|------|--------|
| BR-050 | Admin can manually set any invitee to any status (with confirmation for irreversible transitions). |
| BR-051 | When a group is attached as a live link, new group members are auto-invited. |
| BR-052 | When a group is attached as a snapshot, group changes do not affect the invitee list. |
| BR-053 | Invitees receive a notification on status change where a template exists for that transition. |

### Category Inheritance

| Rule | Detail |
|------|--------|
| BR-060 | New events inherit T&Cs, registration form, and Xero codes from their primary category. |
| BR-061 | Editing a category's defaults does not retroactively update existing events. |

### Location Conflict Detection

| Rule | Detail |
|------|--------|
| BR-070 | Hard conflict: same Bookable already booked for the same time — blocks booking by default. |
| BR-071 | Admin can override a conflict with a password confirmation (override is logged). |
| BR-072 | Soft conflict: sibling bookings exhausting a shared capacity pool — shows warning but allows booking. |

---

## 25. Out of Scope — v1

The following are explicitly out of scope for the initial release:

- Full social-media auto-publishing (Facebook, Instagram, LinkedIn).
- Bi-directional Google / Apple / Microsoft calendar sync.
- Mobile-app authoring for Advanced, Multi-Session, Holiday Program, and Competition event styles.
- Survey automation triggered by attendance.
- AI-assisted natural-language event setup.
- Dynamic demand-based pricing.
- Live-streaming integration and paywalls.
- Public Bookable Network (cross-club venue discovery).
- Sponsor/advertising marketplace on public event pages.
