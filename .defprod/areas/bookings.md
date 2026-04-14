# Area: Bookings

**Key:** `BOOKINGS`
**Description:** The bookable resource layer. Covers creating and managing Venue, Person, and Item bookables; parent/child hierarchies; Master/Slave cloning; all booking types; conflict detection; pricing and availability rules; and archive/deactivation workflows.

---

## User Stories

### BOOKINGS-001 · Create a Venue Bookable
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to create a Venue bookable so that event coordinators can assign physical spaces to events with automatic conflict detection.

**Acceptance criteria:**
- Fields: name, unique internal name (for reporting), type (Venue), location, show-location flag, description, features, rules, primary/secondary media, sponsor media, custom fields.
- Categories and Sports can be assigned to the bookable.
- Max concurrent bookings field sets how many overlapping bookings are allowed.
- Public/Internal flag and Network (public register) flag are configurable.
- Status options: Active, Draft, Archived, Deleted. Hard delete only permitted if no historic or future bookings exist.
- New venue appears in the FM Bookable selector when authoring events.

---

### BOOKINGS-002 · Create a Person Bookable
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to create a Person bookable so that coaches or instructors can expose their availability as bookable slots for private lessons.

**Acceptance criteria:**
- All standard Bookable fields apply (name, type, categories, etc.).
- Availability windows configurable: specific days/times the person is bookable.
- Booking a Person bookable creates a slot reservation against their calendar.
- Person bookables are discoverable via the FM Bookable selector in event authoring.

---

### BOOKINGS-003 · Create an Item Bookable
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to create an Item bookable (locker, boat, kit bag, projector) so that physical items can be reserved alongside events.

**Acceptance criteria:**
- All standard Bookable fields apply.
- Items can be assigned to events/sessions; assignment creates a booking against the item for the event duration.
- Item bookings respect max concurrent bookings.
- Item bookable appears in event authoring Bookable selector with type filter.

---

### BOOKINGS-004 · Set Up Bookable Hierarchy (Parent / Child)
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to organise bookables in a parent/child hierarchy so that booking a parent automatically manages the correct child.

**Acceptance criteria:**
- Hierarchy supports up to 8 levels deep.
- Each child inherits parent properties by default and can override any field independently.
- Booking a parent triggers smart booking: system surfaces the next available child, not all options.
- Dragging children in the admin UI reorders them under a parent.
- When a parent is archived or deactivated, admin is prompted to handle each child's existing bookings.
- Children are displayed as a nested tree in the Bookable admin list.

---

### BOOKINGS-005 · Configure Master / Slave Bookables
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to configure Master/Slave bookables so that I can manage many identical resources (e.g. 30 lockers) without creating each one independently.

**Acceptance criteria:**
- A Master bookable holds defaults; Slaves inherit them and can override individual fields.
- Masters cannot be booked directly.
- Two assignment modes on the Master: force-auto-assign (system picks a slave) or let user pick a specific slave.
- Adding a new Slave automatically inherits all current Master defaults.
- Editing a Master field propagates to Slaves that haven't individually overridden that field.
- Slave-level overrides are visible in the Slave's edit form.

---

### BOOKINGS-006 · Edit Bookable Details
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to edit any field on a bookable at any time so that the record stays accurate as circumstances change.

**Acceptance criteria:**
- All fields are editable post-creation.
- Every edit is logged with actor, timestamp, and before/after field values in a visible audit log.
- Profile info updates (e.g. name change) are reflected on future booking views in real time.
- Name/profile updates do NOT retroactively change already-issued invoices.
- Bulk edit not required for v1 (single-item edit only).

---

### BOOKINGS-007 · Archive a Bookable
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to archive a bookable so that it is hidden from booking flows while preserving its historical record.

**Acceptance criteria:**
- Archive action available on any Active bookable.
- If existing bookings exist (historic or future), admin is prompted: keep bookings as-is, cancel all future bookings, or move future bookings to another bookable.
- Archive cascades through children: admin is shown a list of affected children and must confirm.
- Archived bookables are hidden from the event authoring Bookable selector.
- Archived bookables remain visible in admin lists with an Archived filter; their historical data is preserved.
- Archive action is logged.

---

### BOOKINGS-008 · Deactivate a Bookable Temporarily
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to define repeatable closure windows on a bookable so that it is unavailable during known downtime (e.g. maintenance, holidays).

**Acceptance criteria:**
- Closure windows defined as: one-off date range or recurring (e.g. every Christmas for 3 weeks; two specific courts for 2 weeks).
- During a closure window, the bookable is blocked from new bookings and flagged in conflict detection.
- Admin can override-book during a closure with a password confirmation.
- Customisable user-facing reason message displayed when a registrant encounters a closed bookable.
- Closure windows are visible in the bookable's availability calendar.

---

### BOOKINGS-009 · Create an Event-Driven Booking
**Status:** planned | **Priority:** high

As a Club Admin, I want the system to automatically create a booking record when I assign a Bookable to an event or session so that venue reservations are always in sync with the event schedule.

**Acceptance criteria:**
- Assigning a Bookable to an event or session in the event authoring flow immediately creates a booking record for the event's date/time range.
- Booking is updated automatically if the event's date, time, or duration changes.
- Booking is cancelled automatically if the Bookable is removed from the event.
- Conflict detection runs at the point of assignment; a conflict warning is shown before saving.
- Event-driven bookings are listed in the Bookable's booking history with a link to the source event.

---

### BOOKINGS-010 · Detect and Handle Booking Conflicts
**Status:** planned | **Priority:** high

As a Club Admin, I want the system to detect conflicting bookings so that I don't accidentally double-book a venue or resource.

**Acceptance criteria:**
- Hard conflict: same Bookable (or its parent/child) is already booked for an overlapping period — blocks save and displays a clear error message.
- Admin can override a hard conflict by entering their password; override is logged.
- Soft conflict: sibling bookings exhaust parent capacity (e.g. both halves of a court are individually booked) — warning shown, not blocked.
- Conflict report available in admin showing all upcoming hard and soft conflicts.
- Restriction validation also runs at booking time: age, gender, membership type, qualification restrictions on the bookable are checked against the event's invitee profile.

---

### BOOKINGS-011 · Configure Bookable Pricing and Rules
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to configure pricing rules on a bookable so that bookings are priced consistently based on membership, time, and other factors.

**Acceptance criteria:**
- Base rate configurable per: hour, day, session, week.
- Member vs. non-member rate supported.
- Peak / off-peak pricing by time-of-week (e.g. weekday morning vs. Saturday afternoon).
- Conditional fee rules (from the Finances module rule engine) attachable to a bookable.
- Deposit percentage and cancellation window configurable.
- Pricing preview shown to admin when creating a booking.

---

### BOOKINGS-012 · View Bookable Availability
**Status:** planned | **Priority:** medium

As a Club Admin or Facilities Admin, I want to view a bookable's availability calendar so that I can plan events around existing reservations.

**Acceptance criteria:**
- Availability calendar shows confirmed bookings, pending bookings, and closure windows in distinct visual styles.
- Calendar views: day, week, month.
- Clicking a booking on the calendar opens the booking detail (event name, time, admin contact).
- Availability query respects hierarchy: viewing a parent shows aggregate occupancy of all children.
- Admin can create a one-off or recurring booking directly from the availability calendar.
