# FriendlyManager — Events Platform Upgrade

**Product Specification**

Consolidated product spec covering Events, Bookings, Finances, Public Registration Forms, Lighting & Access Control, and Reporting.

Version 1.0 | April 2026 | Author: Karl

[Prototype (Figma – Pink Zebra)](https://www.figma.com/proto/MD7MX9tK2Vir8hlgtI2Zzh/Pink-Zebra?node-id=9577-101696)

---

## 1. Document Overview

This document consolidates the existing FriendlyManager (FM) event-related specs — the core Events brief, the Events v2 iteration, the Venue/Bookable spec, and the 5-Day Football Camp worked example — into a single product specification intended for a product team to scope, design and build against.

It describes a single integrated platform composed of six tightly-coupled modules:

- **Events** — the authoring, scheduling and participation layer.
- **Bookings** — the bookable resource layer (venues, people, items) underpinning every event.
- **Finances** — pricing rules, ticketing, discounts, payments, refunds, and Xero accounting.
- **Public Registration Forms** — the externally-hosted registration experience.
- **Lighting & Access Control** — physical-layer integrations driven by event/session state.
- **Reporting** — cross-module reporting, dashboards, and data exports.

The worked example used throughout this document is the 5-Day Football Camp scenario. It exercises the majority of the system — multi-day multi-session events, shared NSO→Club event delivery, tiered fees, phased registration windows, waitlists, hold-spot interest, discounts, Xero mapping, and access control.

### 1.1 Goals

- Unify standalone events, class attendance, competitions and public events under one data model.
- Let a National Sports Organisation (NSO) author an event once and distribute it to affiliated clubs, with controlled overrides.
- Handle the full registration lifecycle (interest → hold → confirm → payment → attendance → reporting → refund).
- Support public, internal, private and hybrid events with consistent form, fee and access-control primitives.
- Provide a rich but configurable pricing engine covering tiered tickets, conditional fees, add-ons, early-bird, late fees and discount stacking.
- Integrate cleanly with physical infrastructure (lighting, door access) and financial systems (Xero).

### 1.2 Non-Goals (v1)

- Full social-media auto-publishing (post MVP — see §12).
- Bi-directional Google/Apple/Microsoft calendar sync (post MVP).
- Mobile-app event authoring for Advanced Events (Basic Events only on mobile).
- Survey automation triggered by attendance (future phase).

---

## 2. Personas & Roles

| Persona | Primary Scope | Key Needs |
|---|---|---|
| NSO Admin | Authors master events, sets defaults, distributes to clubs, consolidated reporting | Event templates, category defaults, Xero defaults, cross-club oversight |
| Club Admin / Event Coordinator | Accepts shared events, runs local events, manages attendees and finances | Speed of setup, per-event overrides, mobile for basic events |
| Coach / Session Lead | Runs sessions, takes attendance, manages session-level invitees | Fast attendance, session-level permissions |
| Member (Parent/Player) | Registers, pays, attends, manages family registrations | Clarity on fees, stable registration, waitlist visibility |
| Public Registrant | Non-member signs up through a public URL | Frictionless registration, clear pricing, payment |
| Finance Admin | Reconciles payments, manages refunds, maps Xero codes | Accurate codes per fee, refund-as-credit, audit logs |
| Facilities Admin | Owns venues, lighting profiles, access control | Conflict-free bookings, automated physical-layer triggers |

---

## 3. System Architecture

The six modules share a common core: a unified Event/Session object, a Bookable object, a Person object, and a Fee Rule engine. All modules read and write from a shared permissions, communications and reporting layer.

### 3.1 Module Interaction (summary)

| Module | Produces | Consumes |
|---|---|---|
| Events | Event + Session objects, invitee/attendee records, attendance, tasks | Bookables, Fee Rules, Registration Forms, Access Control |
| Bookings | Bookable resources, booking records, conflicts, availability windows | Events, Lighting/Access profiles |
| Finances | Fees, transactions, invoices, credits, Xero payloads | Events, Registration Forms, Members |
| Public Registration Forms | Registrations, answers, payment intents | Events, Finances, Access Control |
| Lighting & Access Control | Lighting/door schedules, scan events | Events, Bookings |
| Reporting | Dashboards, scheduled reports, exports | Every module |

### 3.2 Core Entities

- **Event** — parent object. Holds category, dates, invitees, core fee config, permissions, reporting settings.
- **Session** — child of an event. Inherits all event fields but can override any. Can be nested one level further (sub-session).
- **Invitee** — a Person or Group attached to an Event/Session with a status (Invited, Confirmed, Declined, Excluded, Interested, Waitlisted, Hold).
- **Bookable** — Venue, Person or Item. Hierarchical (parent → up to 8 levels of children). Supports Master/Slave cloning.
- **Fee Rule** — a conditional price fragment attached to an Event/Session/Add-on. Evaluated at registration time.
- **Registration Form** — schema of fields (standard + custom) bound to an Event with logic, payment and T&C config.
- **Registration** — the completed record of a Person (or Guest) against an Event/Session, with answers, fees, payment and attendance.
- **Category** — taxonomy node carrying default config (T&Cs, forms, fees, permissions, imagery).

---

## 4. Events Module

### 4.1 Event Styles

On creation the user chooses a style that controls the creation flow and the defaults applied:

| Style | Use Case | Creation Flow | Mobile |
|---|---|---|---|
| Basic Event | Simple single-session event (committee meeting, small training) | Single-page, minimal | Yes |
| Advanced Event | Public/ticketed events with complex rules | Multi-step wizard | No |
| Multi-Session Event | Event split into parts with per-session pricing/capacity | Wizard + session editor | No |
| Sports Competition Entries | NSO-managed competition registrations | Wizard + heat/team fields | No |
| Holiday Program / Camp | Multi-day programs with electives and accommodation | Wizard + day/session grid | No |
| Attendance (Class) | Recurring team/class training tied to a Group | Auto-generated from Group | Yes |
| Competition | Internal competition shell (bracket, pool) | Linked to Competitions module | No |

### 4.2 Event Details (common base)

All event styles share this base configuration.

#### Core Info

- Title (required) and rich-text description (headings, bullets, links).
- Category (required; primary + secondary allowed) and optional Discipline link.
- Banner image and file attachments (PDFs, flyers).
- Terms & Conditions — inherited from club default, category default, or event-specific.
- Featured flag (shows on dashboard and member profiles).

#### Dates & Recurrence

- Start/end date-time, all-day toggle.
- Recurrence: weekly, monthly (e.g. first Wednesday), annually, or fully custom (e.g. Mon & Thu for 5 weeks).
- Edit scope on recurring events: this occurrence only | all future | all occurrences.

#### Location & Venue

- Select an FM Bookable (venue/sub-venue) — see §5. Conflict checks run automatically with admin-password override.
- Or: free-text address (Google Places autocomplete).
- Or: Online — reveals a meeting-link field.
- Sessions and sub-sessions may override the parent venue.

#### Invitees

Uses the FM Selector (existing component — see the Selector brief) to pick any combination of:

- Individuals, system groups (teams, classes), permission roles, jobs, tags, disciplines.
- Dynamic filter expressions, e.g. `Gender = Female AND Age BETWEEN 12 AND 18 AND CustomField[Goalie] = true`.
- Multiple invitee groups may be added to one event (each group can drive its own fee/permissions — see §6).

**Maintained vs. Snapshot connection:** when attaching a system group the author is prompted to maintain a live link (new group members auto-inherit invitee status and pricing) or snapshot (point-in-time copy).

#### Invitee Controls

- Allow members to see who is attending.
- Allow members to see attendee count only.
- Allow Interested / Going responses.
- Allow guests (with max-per-invitee).
- Sub-grouping (e.g. tables of 6) with drag-and-drop ordering.

#### Invitee Status

| Status | Meaning |
|---|---|
| Invited | Awaiting response |
| Confirmed | Coming |
| Declined | Not coming |
| Excluded | In the group but explicitly excluded |
| Interested | Soft indication of intent |
| Hold (24h) | Reserved pending parent confirmation (see §4.6) |
| Waitlisted | Event full; auto-promoted when a spot opens |

#### Capacity, Limits & Waitlist

- Set min/max per Event and per Session. Session limits override the parent.
- Overflow goes to waitlist. When someone drops, the first waitlisted person is auto-promoted and notified.
- Restrictions validated on invite and accept: Gender, Age Range, Tracker/Qualification, Membership Type.

#### Real-time Registration Status

- Show live "X of Y spots left".
- Optional threshold messaging ("Only 2 spots remaining!").

### 4.3 Event Categories

- Hierarchical (nested). Subcategories inherit defaults from parents unless overridden.
- Defaults carried: T&Cs, imagery, registration form, fee structure, permissions, invitees, communications, default venue, dietary fields, Xero codes.
- Visual identity: color + icon shown in calendars and listings.
- Usage reporting by category (see §9).

**Example:** a "Junior Events" category pre-applies age filter 5–12, a yellow color, the Junior Training Field, a junior registration form and guardian-contact requirement.

### 4.4 Sessions

A session is a child event inside another event. It has all the same properties as an event, and can be split further into sub-sessions (one additional level).

- Required vs. Optional — Required sessions must be attended by all registrants; Optional sessions are selected during registration.
- Session-level permissions can restrict who views or manages attendance.
- Sessions may be visibility-gated — revealed only after registration or at a scheduled date/time.
- Each session may have its own Bookable, fee, capacity, invitee rules and access profile.

#### Worked example — 5-Day Camp session grid

| Day | Session | Time | Location | Fee | Optional? | Restrictions |
|---|---|---|---|---|---|---|
| Mon | Breakfast | 6:00–8:00 | Conference Room | Included | Required | Members + Parents |
| Mon | Skills | 6:00–10:00 | Football Field 1 & 2 | Included | Required | — |
| Mon | Fitness | 10:00–15:00 | Gym | Included | Required | — |
| Mon | Goalie Expert | 10:00–15:00 | Football Field 1 | $200 | Optional | CustomField Goalie = true AND age 9–13 |
| Mon | VIP Lunch | 11:30–13:00 | Conference Room | Included | Optional | VIP group only |
| Day 5 | Electives (6 options) | TBD | Various | Varies | Required choice | — |

### 4.5 Event Sharing (NSO → Club)

NSOs create master events, share them to member clubs. Clubs accept, optionally override, and publish. Governs the 5-Day Football Camp scenario end-to-end.

- NSO creates master event and assigns default Xero codes to each fee category.
- NSO chooses what is overridable per club (e.g. Club Fee can be increased; NSO/Kit/Qualification fees locked).
- Club accepts → assigns/overrides Xero codes → optionally raises Club Fee → invites members.
- Members only see their club's version. Reporting rolls up to NSO.
- Sharing permissions: share members to the shared org's comms (opt-in), allow advertising content, etc.

### 4.6 Registering Interest (Hold-Spot)

Critical for youth/parent-driven registrations.

- Child registers interest → system reserves a spot for 24 hours and notifies parent/guardian.
- Parent confirms within 24h → registration secured.
- No confirmation → spot released; child moves to waitlist if event is full.
- Admin-visible hold queue with expiry timers.

### 4.7 Phased Registration Access

| Phase | Who | Window |
|---|---|---|
| Member Exclusive | Club members only | Opens N days before event (default 40) |
| Public Access | Anyone via public URL | After the member window closes |

Windows are configurable per event, per category, or inherited from NSO defaults.

### 4.8 Event Sub-Types

#### Connected Events

A unique-to-sport feature. Three football teams play Saturday; each game is a distinct event but admins need a single view of all attendees across the three to drag-and-drop people between games.

- A "Connection Group" links related events and provides a combined attendee view.
- Drag-and-drop moves invitees/attendees between connected events while preserving fees and statuses.

#### Public Events

- Public URL with a tailored landing page — banner, description, live capacity, registration CTA.
- Registrants do not need an FM account. If they use an email already in FM, the event is surfaced in their app.
- Optional: require account creation post-registration for future communications.

#### Internal Events

- Restricted to the organisation; not discoverable publicly.

#### Class Attendance

- Auto-generated from a Group's session times.
- Attendance rolls as new members join the group mid-term.

### 4.9 Import

- CSV import of events for external competitions or third-party-authored events that the club still wants to manage attendance for.
- Field mapper with validation preview.

### 4.10 Event Tabs (authoring UI)

Details · Sessions · Invitees · Registration · Attendees · Notes/Tasks · Automations · Reporting · Finances · Communications

### 4.11 Communication

- Communicate with any invitee group sliced by status, sub-group, session, or Boolean combination.
- Routes via FM Mailer; all sends logged against the recipient and the event.
- Automated comms per registration milestone (hold created, confirmation required, payment due, refund deadline approaching, waitlist promotion).

### 4.12 Attendance

- Intention tracking ("is coming?") distinct from physical attendance.
- Per-session attendance (e.g. Morning / Lunch / Dinner). Required-minimum logic (e.g. "must attend 4 of 5 days") drives completion reporting.
- Bulk-action toolbar on attendance reports (message, waitlist, refund, tag, etc.).

### 4.13 Tasks

- Title, description, due date, assignee, linked person, status.
- Assigned tasks surface on the assignee's FM dashboard.

### 4.14 Permissions

| Permission | Scope |
|---|---|
| Create Events | Per category / per club |
| Edit Events | Own / All / By category |
| Delete Events | Own / All |
| Manage Tickets & Fees | Per event |
| View Attendees | Per event / per session |
| Take Attendance | Per event / per session |
| Manage Waitlist & Holds | Per event |
| Share/Accept shared events | NSO / Club |

### 4.15 Event Reporting (in-module)

- Attendance by session, by person, by group, by category.
- Registration funnel (views → interest → hold → confirmed → paid → attended).
- Waitlist conversion, drop-off, refund rate.
- Export to CSV/XLSX; schedule by email; push into the Reporting module for cross-module analysis (§9).

---

## 5. Bookings Module

Built around a single Bookable primitive covering three types:

| Type | Examples |
|---|---|
| Venue | Pool, field, meeting room, court, sub-venue (Half, Quarter, Lane) |
| Person | Coach, instructor, manager — offers bookable training |
| Item | Locker, boat, kit bag, marquee, projector |

### 5.1 Bookable Administration

Admins create Bookables with these attributes (core fields only — see source spec for the exhaustive list):

- Name, Unique Internal Name (for reporting), Type, Location, Show-location flag.
- **Parent/Child** — hierarchy up to 8 levels deep. Booking a parent books the correct child; children can have all the same properties as parents (own images, sponsor, name).
- **Master/Slave** — a master holds defaults; slaves (e.g. 30 identical lockers) inherit them and each can override individual fields. Masters cannot be booked; admins can force-auto-assign or let the user pick a specific slave.
- **Status**: Active, Draft, Archived, Deleted (hard delete only if no historic or future bookings). Private/Internal, Network (public register) flag.
- Max concurrent bookings, Categories, Sport(s), Description, Features, Rules, Primary/secondary media, Sponsor media, Custom fields.

### 5.2 Hierarchy Behaviour

- Parent and child can have independent booking rules and pricing.
- Drag-and-drop reorder of children under a parent.
- Smart booking: when a user re-books a "quarter court", the system surfaces the next available quarter — not all options.

### 5.3 Edit / Archive / Deactivate

- **Edit**: all fields editable at any time. All changes logged with before/after, who and when (visible audit log).
- Profile info updates on existing bookings in-place (e.g. new name shows on future invoice views) except on issued invoices.
- **Archive**: hide from booking flows and public pages. If bookings exist, admin is prompted to keep, cancel or move them to another bookable. Recursive through children.
- **Deactivate (temporary)**: repeatable closure windows (e.g. every Christmas for 3 weeks; two courts for 2 weeks for painting). Admins can still override-book during closure. Customisable user-facing reason message.

### 5.4 Booking Types

- One-off — a single slot on a specific date.
- Recurring — weekly/custom (e.g. boat locker for 10 weeks).
- Seasonal — deactivated outside a season.
- Event-driven — created automatically when an Event/Session is assigned a Bookable.
- Person booking — a coach's availability exposed as bookable slots for private lessons.

### 5.5 Conflicts

- Hard conflict when a Bookable (or its parent/child) is already booked — blocking unless admin enters their password.
- Soft conflict when sibling booking exhausts capacity (e.g. both halves of a court are booked individually).
- Conflict report surfaces upcoming double-bookings for review.

### 5.6 Pricing & Rules on Bookables

- Base rate per hour/day/session/week.
- Member vs. non-member rate.
- Peak / off-peak by time-of-week.
- Conditional fee rules (see §6.2) — e.g. group rate, role-based discount.
- Deposit % and cancellation window.

---

## 6. Finances Module

Single pricing engine used by Events, Sessions, Bookings, Registration Forms and Add-ons. Drives the 5-Day Camp fee structure as well as the multi-tier ticketing matrix in Events v2.

### 6.1 Fee Structure Primitives

- **Base Fee** — the event/session/bookable price.
- **Fee Components** — sub-amounts within the base (Kit, Qualification, NSO, Club). Each component has its own Xero account code and its own lock/editable flag.
- **Add-ons** — additional purchasable items (merchandise, extra sessions, VIP tickets, dietary upgrade).
- **Deposits** — a % of a component due at signup (e.g. 50% of Kit Fee).
- **Instalments** — schedule of payment milestones with automated reminders (full payment required 20 days before the event, etc.).

#### Worked example: 5-Day Camp base fee

| Component | Amount | Notes | Editable by Club? |
|---|---|---|---|
| Kit Fee | $225 | 50% ($112.50) due at signup | No |
| Qualification Fee | $100 | Paid upfront | No |
| NSO Fee | $100 | Paid upfront | No |
| Club Fee | $575 | Can be increased; extra components can be added | Yes |
| **Total** | **$1,000** | Base camp fee | — |

### 6.2 Conditional Rule Pricing

A Fee Rule is a condition → price-modifier pair. Rules are evaluated at registration and are stackable (order controllable). Supported conditions:

- Group-based — in / not in a system group.
- Membership — by membership type.
- Person-type.
- Role / Permission.
- Tag.
- Field-based — a form-field equals a value.
- Age, Gender, Discipline, Qualification/Tracker.
- Time-based — early-bird window / late fee window.

#### Worked example: per-group / per-session tiered pricing

From Events v2 — the matrix the engine must be able to express for a single event:

| Session | Juniors | Seniors | Senior Guests | Public Jnr | Public Snr | VIP |
|---|---|---|---|---|---|---|
| Morning | $10 | $20 | $40 | $10 | $40 | — |
| Lunch | $25 | $45 | $50 | $25 | $50 | — |
| Afternoon | $10 | $20 | $60 | $10 | $50 | — |
| Dinner | $130 | $180 | $200 | $130 | $200 | $60 |

Group definitions are reusable across events and expressed as Selector filters: e.g. "Juniors" = Boys AND age > 10 AND in Juniors team.

### 6.3 Add-ons

- **Object add-ons** — tracker items, merchandise, sub-events, bookable items (a t-shirt, a football, a Parent's Night VIP ticket).
- **Field-value add-ons** — a form field whose selected option carries a financial amount ("gluten-free +$10"; dropdown with three priced options).
- Add-ons have their own Xero codes, stock limits, refund policy and visibility rules.

### 6.4 Discounts

- **Sibling** — e.g. 25% off second sibling's base fee.
- **Training-linked** — attend N linked training sessions → discount off main event (e.g. 10% off base camp for 2+ linked training sessions).
- **Code-based** — discount codes (flat / %, usage caps, expiry, eligibility filters).
- **Role-based** — auto-applied to members with a specific role.

Discounts are stackable by default and evaluated before final payment. Ordering of application is configurable.

### 6.5 Early-Bird / Late Fees

- Define N time windows with price modifiers (a month before = $100; two weeks before = $150).
- UI shows the currently-active price and the next transition.

### 6.6 Unique Ticket Numbers

- Toggle: "Generate unique ticket ID per registration".
- Future: QR code for scanning at access-control points (see §8).

### 6.7 Payment Methods

- Per-event payment-method selection with a system default (credit card, invoicing, direct debit, account credit).
- Example: one event allows invoicing and credit card; another is credit-card only.
- Re-uses registration-form payment logic.

### 6.8 Refunds

- Per-event refund deadline surfaced on the registration UI.
- Refunds default to account credit (balance held against the user's profile for future events). Cash/reverse-charge refunds optional.
- Refund audit log with reason, amount, processor, Xero reversal entry.

### 6.9 Xero Integration

- Every Fee Component / Add-on maps to a Xero account code.
- NSO supplies defaults on shared events. Clubs must confirm or override codes during event acceptance — event cannot be published without a mapped code on every fee.
- Invoice and payment sync, with reconciliation view in FM (matched / unmatched / failed).

---

## 7. Public Registration Forms

Registration forms are the externally-hosted entry point for public events and the in-app entry point for internal events. Re-uses the new FM form builder.

### 7.1 Form Builder

- Drag-and-drop builder with standard fields (name, DOB, email, phone, address, emergency contact) and custom fields (any type, validated).
- Event-only data capture — fields whose answers are stored against the Registration (not the Person profile), e.g. dietary needs for this camp only.
- Person-data capture — fields that update the Person profile on successful registration.
- Conditional logic — show/hide, require, branch based on prior answers.
- Multi-page forms with progress indicator.

### 7.2 Built-in Sections

- Event summary + pricing preview that updates live as the user selects sessions/add-ons.
- Terms & Conditions block (inherited or custom).
- Payment options (filtered by event config).
- Elective picker — e.g. Day 5 choose 1-of-6 electives.
- Sibling registration — add additional participants in one flow with auto-applied sibling discount.

### 7.3 Public vs. Authenticated

- Public flow: no FM account required. If email matches an FM user, surface the event in their app post-registration.
- Authenticated flow: auto-fill from profile, skip identity fields.
- Guest tickets: the registrant may purchase tickets for non-FM guests (name + email + any custom fields).

### 7.4 Category & Event Inheritance

- A category can nominate a default registration form.
- An event overrides the category's form (full custom or duplicated-and-edited).

### 7.5 Hold-Spot Flow on the Form

- If hold-spot is enabled, a minor registering solo submits a "hold" rather than a paid registration.
- Parent/guardian email captured is sent a branded confirmation link with 24h expiry.
- On confirm → payment screen; on expiry → released + waitlist option shown.

### 7.6 Accessibility & Localisation

- WCAG 2.2 AA target.
- Language/locale per club; currency per club.

---

## 8. Lighting & Access Control

Physical-layer integrations driven by event and booking state. Two capabilities share a single configuration model: Profile → Schedule → Trigger.

### 8.1 Profiles

- **Lighting profile** — lights/zones, levels, ramp-up and cool-down windows (e.g. fields on at 50% 10 min before, 100% at start, off 15 min after).
- **Access profile** — doors / barriers and who may unlock them (role, tag, registered-attendee, ticket-QR scan).
- Profiles are attached to Bookables (default) and can be overridden per Event or per Session.

### 8.2 Schedule Generation

- When an event is published or accepted, schedules are generated automatically from event and session times + the attached profiles.
- Schedules respect buffers, deactivations and overlapping bookings (union/merge).
- Manual override window — "turn on now" / "extend by 30 min" from the event or mobile app.

### 8.3 Access Triggers

- QR / Unique Ticket ID scan → validates against the registration record; grants door unlock for the event window.
- Member credential scan → validates against invitee/attendee list.
- Anti-passback and overflow limits (respect event capacity).
- All scan events logged (person, door, time, result) and surfaced in reporting.

### 8.4 Hardware Integrations (v1 targets)

- Generic webhook / REST endpoint so any relay-based controller can be wired up.
- Named integrations: Philips Hue / DALI / KNX (lighting); HID, Paxton, Salto (access). Final list to be scoped during discovery.
- Fallback: scheduled iCal feed for controllers that only speak calendar.

### 8.5 Safety Rules

- Fail-safe: if the platform cannot reach the controller, lights/access remain in their last safe state.
- Emergency override from Facilities Admin regardless of current state.
- Audit log of every state change.

---

## 9. Reporting Module

A single reporting layer that reads from every module. Provides pre-built reports, a custom report builder, scheduled delivery, and export.

### 9.1 Pre-built Reports

| Report | Key Dimensions / Outputs |
|---|---|
| Attendance | Per event, per session, per person, per group, per category; day-of arrival, no-shows, % attendance |
| Registration Funnel | Views → Interest → Hold → Confirmed → Paid → Attended; drop-off by step |
| Financial Summary | Revenue by fee component, add-on, category, club (rolled up for NSO). Xero reconciliation status |
| Discount Usage | Codes, sibling, training-linked — count, value, conversion |
| Waitlist & Holds | Size, wait time, promotion rate, expiry rate |
| Bookable Utilisation | % booked per bookable, by hour/day/week, conflicts |
| Access Control | Scans by door, grants vs. denials, unknown credentials |
| Category Usage | Events/attendance per category, YoY |
| Refunds & Credits | Value, reason, average time-to-refund |
| Member Engagement | Events attended per member, last-attended, inactive members |

### 9.2 Custom Report Builder

- Pick a base entity (Event, Registration, Booking, Transaction, Scan).
- Add columns across related entities (person fields, event fields, fee components, etc.).
- Apply filters using the FM Selector expression language.
- Group, pivot, aggregate (sum/avg/count/distinct).
- Save, share (with permissions), schedule (email CSV/XLSX/PDF).

### 9.3 Bulk Actions on Reports

Every attendee/person-based report surface supports bulk actions: message, add tag, add to group, refund, waitlist promote, generate tasks, export.

### 9.4 Dashboards

- Role-based dashboards (NSO / Club Admin / Coach / Finance / Facilities).
- Drill-through from every widget to the underlying report.

### 9.5 Data Export & API

- CSV, XLSX, PDF export on every report.
- Read API for every entity, OAuth-scoped; webhooks on registration, payment, refund, scan, conflict.

---

## 10. Cross-Cutting Requirements

### 10.1 Permissions & Roles

- Role-based with fine-grained scope (own / category / club / NSO).
- Event Coordinators can be assigned per event with a reduced permission bundle.
- Admin-password override flow for venue double-book and deactivation bypass.

### 10.2 Audit & Logging

- Every create/edit/delete logged with actor, timestamp, before/after.
- Critical flows (payments, refunds, overrides, access grants) additionally surface in a separate security log.

### 10.3 Notifications

- Email (via Mailer) and in-app notifications as the default channels; SMS as an optional add-on.
- Triggered from: invitation, hold created, hold expiring, confirmation required, payment due/overdue, waitlist promotion, refund window closing, event updates, schedule changes.

### 10.4 Data Model Principles

- Single Event/Session entity shared across standalone events, class attendance and competitions.
- All entities versioned for audit.
- Group connections are either Live (auto-update) or Snapshot — explicitly selected by the author.

### 10.5 Mobile & Tablet

- Basic Events can be authored on mobile/tablet.
- Advanced, Multi-Session, Holiday Program and Competition events are desktop-only for authoring.
- All attendee/attendance/scan flows are fully mobile-supported.

---

## 11. Migration

### 11.1 Migration Wizard

- Source-system connector for the current FM events model; dry-run report for every org.
- Category mapping — existing event tags/types → new category tree.
- Fee mapping — existing fee strings → Fee Components + Xero codes.
- Historic attendance and registrations imported read-only; new events use the new stack.

### 11.2 Cutover Strategy

- Parallel run per club for one month.
- Feature flags by module (Events, Bookings, Finances, Public Forms, Access, Reporting) so clubs can adopt progressively.

---

## 12. Future Work

- **Automations** — event → survey, event → post-attendance workflows; configurable trigger/condition/action builder tied to any lifecycle event (registration, payment, attendance, refund).
- **Social-media auto-publishing** — one-click push of public events to Facebook, Instagram, LinkedIn with branded assets.
- **Calendar sync** — bi-directional Google / Apple / Microsoft calendar sync for members and coordinators.
- **Public Bookable Network** — cross-club venue discovery and booking; clubs opt-in to expose their Bookables to the FM-wide network.
- **AI-assisted event setup** — natural-language event creation ("set up a 5-day camp for juniors starting July 14 with these electives") that drafts the full event config.
- **QR self-check-in** — scannable tickets on the member app for door/zone access and attendance capture.
- **Survey automation** — trigger post-event surveys and roll responses into reporting.
- **Mobile authoring parity** — bring Advanced and Multi-Session authoring to tablet once the desktop patterns stabilise.
- **Sponsor/advertising marketplace** — sell sponsor slots on public event pages and registration forms.
- **Dynamic pricing** — demand-based price adjustments within author-defined bounds.
- **Live-streaming integration** — attach stream links and paywalls to events for remote attendees.

---

*End of specification.*
