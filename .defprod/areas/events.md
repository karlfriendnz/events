# Area: Events

**Key:** `EVENTS`
**Description:** The core authoring, scheduling, and participation layer. Covers all event styles, the event/session hierarchy, invitee management, capacity and waitlist, hold-spot flow, phased registration, NSO-to-Club sharing, attendance, tasks, communications, and in-module reporting.

---

## User Stories

### EVENTS-001 · Create a Basic Event
**Status:** planned | **Priority:** high

As a Club Admin, I want to create a Basic Event using a minimal single-page form so that I can quickly set up simple events like committee meetings or small training sessions.

**Acceptance criteria:**
- Single-page creation form with: title, category, start/end date-time, all-day toggle, location, and invitees.
- Category field is required; form cannot submit without it.
- Location supports three modes: FM Bookable selector, free-text address (Google Places autocomplete), and Online (reveals meeting-link field).
- Event is saved in Draft state; admin can publish separately.
- Basic Event authoring is available on mobile and tablet.
- Created event appears in the admin event list and on the relevant member calendar.

---

### EVENTS-002 · Create an Advanced Event
**Status:** planned | **Priority:** high

As a Club Admin, I want to create an Advanced Event using a multi-step wizard so that I can configure complex rules, ticketing, and public visibility.

**Acceptance criteria:**
- Multi-step wizard with clearly labelled steps: Details → Sessions → Invitees → Registration → Fees → Publish.
- Each step validates before advancing; user can navigate back without losing progress.
- Rich-text description editor supports headings, bullets, and links.
- Banner image upload and file attachment (PDF, flyer) supported.
- Terms & Conditions inherited from club or category default, with option to override per event.
- Featured flag option surfaces the event on the dashboard and member profiles.
- Advanced Event authoring is desktop-only (not available on mobile).

---

### EVENTS-003 · Create a Multi-Session Event
**Status:** planned | **Priority:** high

As a Club Admin, I want to create a Multi-Session Event so that I can run programs where different sessions have independent pricing, capacity, and scheduling.

**Acceptance criteria:**
- Wizard + session editor where sessions are added within the event authoring flow.
- Each session inherits the parent event's properties by default and can override: title, date/time, location (Bookable), capacity, fee, invitee rules, and access profile.
- Sessions can be marked Required (all registrants must attend) or Optional (selected at registration time).
- Session grid shows all sessions in a calendar or tabular view.
- Parent event and session capacities are tracked independently; registrants are counted against both.
- Multi-Session Event authoring is desktop-only.

---

### EVENTS-004 · Create a Holiday Program / Camp Event
**Status:** planned | **Priority:** high

As a Club Admin or NSO Admin, I want to create a Holiday Program / Camp event with a day-and-session grid so that I can manage complex multi-day programs with electives.

**Acceptance criteria:**
- Wizard includes a day/session grid editor where sessions are grouped by day.
- Each day can contain multiple sessions; sessions within a day can have different locations, fees, and restrictions.
- Elective sessions can be configured: registrant must choose exactly 1 of N options at registration.
- Sub-sessions (one level below session) are supported.
- Restrictions on individual sessions (e.g. `CustomField[Goalie] = true AND Age 9–13`) can be applied independently per session.
- Worked example (5-Day Football Camp) from the spec is achievable without workarounds.

---

### EVENTS-005 · Configure Event Recurrence
**Status:** planned | **Priority:** medium

As a Club Admin, I want to set a recurrence pattern on an event so that I don't have to manually create the same event every week.

**Acceptance criteria:**
- Recurrence options: weekly, monthly (e.g. first Wednesday of each month), annually, and fully custom (e.g. Mon & Thu for 5 weeks).
- Preview shows the next N occurrences before saving.
- Editing a recurring event prompts scope selection: this occurrence only | all future occurrences | all occurrences.
- Deleting a single occurrence does not affect others unless "all" scope is selected.
- Recurring events appear as individual entries on calendars and event lists.

---

### EVENTS-006 · Manage Event Categories
**Status:** planned | **Priority:** high

As a Club Admin, I want to create and manage event categories so that events inherit sensible defaults and are visually organised.

**Acceptance criteria:**
- Categories are hierarchical; subcategories inherit defaults from parents unless overridden.
- Defaults carried by a category: T&Cs, imagery, registration form, fee structure, permissions, invitees, communications, default venue, dietary fields, Xero codes.
- Each category has a colour and icon displayed in calendar and listing views.
- Primary and secondary category can be assigned to an event.
- Editing a category's defaults does not retroactively change existing events; only new events inherit the updated defaults.
- Category usage report available (see Reporting area).

---

### EVENTS-007 · Add Invitees Using the FM Selector
**Status:** planned | **Priority:** high

As a Club Admin, I want to add invitees to an event using the FM Selector so that I can target individuals, groups, roles, or dynamic expressions in a single step.

**Acceptance criteria:**
- FM Selector supports picking: individuals, system groups (teams, classes), permission roles, jobs, tags, disciplines.
- Dynamic filter expressions supported (e.g. `Gender = Female AND Age BETWEEN 12 AND 18 AND CustomField[Goalie] = true`).
- Multiple invitee groups can be added to one event; each group can drive its own fee and permissions.
- When attaching a system group, admin is prompted to choose: maintain live link (auto-inherit new members) or snapshot (point-in-time copy).
- Selected invitees are previewed with a count before saving.
- Invitees receive a notification when they are added to an event.

---

### EVENTS-008 · Configure Invitee Controls
**Status:** planned | **Priority:** medium

As a Club Admin, I want to control what invitees can see and do on an event so that I can balance transparency with privacy.

**Acceptance criteria:**
- Toggle: allow members to see the full attendee list.
- Toggle: allow members to see attendee count only (not names).
- Toggle: allow Interested / Going responses.
- Toggle: allow guests, with a configurable max-guests-per-invitee field.
- Sub-grouping support: define groups (e.g. tables of 6) with drag-and-drop ordering of members within each group.
- These controls are per-event and can be overridden per session.

---

### EVENTS-009 · Manage Invitee Status
**Status:** planned | **Priority:** high

As a Club Admin, I want to view and update the status of each invitee so that I have accurate insight into who is coming.

**Acceptance criteria:**
- All seven statuses are supported: Invited, Confirmed, Declined, Excluded, Interested, Hold (24h), Waitlisted.
- Admin can manually set any invitee to any status (with confirmation prompt for irreversible transitions).
- Bulk status update available from the attendee list.
- Invitee receives a notification on status change (where a notification template is defined for that transition).
- Status history is visible in the invitee's event record.

---

### EVENTS-010 · Set Event Capacity and Waitlist Rules
**Status:** planned | **Priority:** high

As a Club Admin, I want to set minimum and maximum capacity limits on an event and its sessions so that registration is automatically managed.

**Acceptance criteria:**
- Min and max capacity configurable per event and per session; session limits override parent.
- When max is reached, new registrants are placed on the waitlist automatically.
- When a confirmed registrant cancels, the first waitlisted person is auto-promoted and notified.
- Live "X of Y spots left" counter displayed to registrants on the registration form.
- Optional threshold message configurable (e.g. "Only 2 spots remaining!") that displays when spots fall below a set number.
- Waitlist position is visible to the waitlisted registrant.

---

### EVENTS-011 · Configure Hold-Spot Registration
**Status:** planned | **Priority:** high

As a Club Admin, I want to enable a hold-spot flow so that a child's registration is confirmed by a parent before a spot is permanently secured.

**Acceptance criteria:**
- Hold-spot toggle enabled per event (default off).
- When a minor submits a registration, a spot is reserved and a Hold (24h) status is set.
- Parent/guardian email captured during registration receives a branded confirmation link with 24-hour expiry timestamp.
- Parent confirms within 24h → registration transitions to Confirmed; payment flow is triggered.
- No parent confirmation within 24h → spot is released; child moves to Waitlisted if the event is full; child is notified.
- Admin hold queue shows all active holds with expiry countdown timers.
- Admin can manually extend or cancel a hold.

---

### EVENTS-012 · Configure Phased Registration Windows
**Status:** planned | **Priority:** high

As an NSO Admin or Club Admin, I want to configure phased registration access so that club members get early access before the event is opened to the public.

**Acceptance criteria:**
- Two phases configurable: Member Exclusive (club members only) and Public Access (anyone via public URL).
- Default member-exclusive window opens N days before the event (default 40 days); configurable per event.
- Public access phase opens after the member window ends (or at a manually set date/time).
- Phase configuration can be inherited from event category or NSO defaults.
- Registration form shows the current phase and, if the public phase is not yet open, a countdown to opening.
- Registrants who don't qualify for the current phase see a clear message explaining when they can register.

---

### EVENTS-013 · Share an Event (NSO → Club)
**Status:** planned | **Priority:** high

As an NSO Admin, I want to share a master event to affiliated clubs so that each club gets a pre-configured copy they can adapt within allowed bounds.

**Acceptance criteria:**
- NSO creates a master event and selects which clubs to share it to.
- NSO configures per-fee-component overridability: locked (club cannot change) or editable (club can override).
- NSO assigns default Xero codes to each fee component before sharing.
- Shared event appears in each club's event list as "Pending Acceptance."
- Club is notified when a shared event arrives.
- Club can override only the fields the NSO has marked editable.
- Sharing permissions include: share member data to the NSO's comms (opt-in), allow advertising content on the event.

---

### EVENTS-014 · Accept a Shared Event as Club Admin
**Status:** planned | **Priority:** high

As a Club Admin, I want to accept a shared event from the NSO so that I can publish it to my members with my local overrides applied.

**Acceptance criteria:**
- Acceptance flow guides the club admin through: review NSO defaults → assign/override Xero codes → optionally raise Club Fee → confirm invitees.
- Event cannot be published without a mapped Xero code on every fee component.
- Club admin can add club-specific fee components (within NSO-permitted bounds).
- Once accepted and published, members only see the club's version of the event.
- NSO reporting rolls up registrations and revenue across all club versions of the event.

---

### EVENTS-015 · Create and Manage Connected Events
**Status:** planned | **Priority:** medium

As a Club Admin, I want to group related events into a Connection Group so that I can view and manage attendees across all of them in one place.

**Acceptance criteria:**
- Multiple events can be linked into a Connection Group.
- A combined attendee view shows all invitees across all linked events in one table.
- Drag-and-drop moves an invitee/attendee from one connected event to another.
- Moving an invitee preserves their existing fee and status; admin is warned if fees differ between events.
- Connection Group view is accessible from each member event's detail page.

---

### EVENTS-016 · Create a Public Event
**Status:** planned | **Priority:** high

As a Club Admin, I want to create a public event with a public URL and a branded landing page so that non-members can discover and register for the event.

**Acceptance criteria:**
- Public URL generated on event publication; admin can share or embed it.
- Landing page displays: banner image, event title, description, date/time, location, live capacity, and a Register CTA.
- Registration does not require an FM account.
- If a public registrant's email matches an existing FM user, the event is surfaced in their FM app post-registration.
- Option to require account creation post-registration for future communications.
- Public events are visible in the member-exclusive phase only to club members; public URL is activated at the public-access phase start.

---

### EVENTS-017 · Import Events via CSV
**Status:** planned | **Priority:** low

As a Club Admin, I want to import events from a CSV file so that I can bulk-load fixtures from external competition management systems.

**Acceptance criteria:**
- CSV import available from the event list with a "Import events" action.
- Field mapper UI lets admin map CSV columns to FM event fields.
- Validation preview shows errors per row (missing required fields, invalid dates, duplicate titles) before committing.
- Import creates events in Draft state; admin must publish individually or in bulk.
- Import log records how many rows succeeded and failed.
- Failed rows can be corrected in-place and re-submitted without re-uploading the file.

---

### EVENTS-018 · Manage Event Tasks
**Status:** planned | **Priority:** low

As a Club Admin or Event Coordinator, I want to create tasks linked to an event so that action items are tracked and assigned.

**Acceptance criteria:**
- Task fields: title, description, due date, assignee (FM user), linked person (optional), status (Open / In Progress / Done).
- Tasks are created from the event's Tasks tab.
- Assigned tasks appear on the assignee's FM dashboard.
- Overdue tasks are visually flagged.
- Tasks can be filtered by status and assignee on the event Tasks tab.

---

### EVENTS-019 · Communicate with Event Invitees
**Status:** planned | **Priority:** high

As a Club Admin, I want to send targeted communications to invitee subsets so that I can reach the right people at the right time.

**Acceptance criteria:**
- Communications initiated from the event's Communications tab.
- Audience can be sliced by: invitee group, status, sub-group, session, or Boolean combination (e.g. Confirmed AND Session=Morning).
- Routes via FM Mailer; preview rendered before sending.
- All sends logged against the recipient record and the event.
- Automated communications triggered at registration milestones: hold created, confirmation required, payment due, refund deadline approaching, waitlist promotion.
- Admin can view delivery status (sent, opened, failed) per send.

---

### EVENTS-020 · Take Attendance
**Status:** planned | **Priority:** high

As a Coach or Session Lead, I want to record attendance per session so that the event has an accurate record of who actually showed up.

**Acceptance criteria:**
- Attendance is tracked separately from registration intention ("is coming?" vs. physically present).
- Per-session attendance view shows all registered invitees with an attendance toggle.
- Bulk mark-all-present option available.
- Required-minimum logic supported: e.g. "must attend 4 of 5 days" — system flags registrants who haven't met the minimum at the end of the event.
- Attendance view is fully functional on mobile.
- Bulk-action toolbar on the attendance report: message, waitlist, refund, tag.

---

### EVENTS-021 · View In-Module Event Reporting
**Status:** planned | **Priority:** medium

As a Club Admin, I want to see event-specific reports directly within the event UI so that I can monitor performance without navigating to the Reporting module.

**Acceptance criteria:**
- Reporting tab on the event shows: attendance by session, by person, by group, by category.
- Registration funnel visible: views → interest → hold → confirmed → paid → attended, with drop-off percentages at each step.
- Waitlist conversion rate, drop-off rate, and refund rate shown.
- All report data exportable to CSV/XLSX from the tab.
- Reports can be scheduled for email delivery (links to Reporting module scheduler).

---

### EVENTS-022 · Configure Event-Level Permissions
**Status:** planned | **Priority:** medium

As a Club Admin, I want to assign specific permissions to users on an event so that I can delegate event coordination without giving broad admin access.

**Acceptance criteria:**
- Permissions assignable at event level: View Attendees, Take Attendance, Manage Waitlist & Holds, Manage Tickets & Fees.
- Event Coordinator role bundle assignable per event to any FM user.
- Permissions are additive to the user's global role; event-level grants do not remove global permissions.
- Permission changes are logged in the event audit log.
- Scopes: own events / all events / by category for Create, Edit, and Delete permissions.
