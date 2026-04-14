# Area: Lighting & Access Control

**Key:** `LAC`
**Description:** Physical-layer integrations driven by event and booking state. Covers lighting profiles, access profiles, automatic schedule generation from event/session times, manual overrides, QR/ticket-ID and member-credential scanning, hardware integrations, safety rules, and audit logging of all physical-layer events.

---

## User Stories

### LAC-001 · Create a Lighting Profile
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to create a lighting profile so that the correct lighting behaviour is automatically applied whenever a venue is in use.

**Acceptance criteria:**
- Lighting profile fields: name, zones/lights covered, levels (percentage), ramp-up window (minutes before event start to begin warming lights), cool-down window (minutes after event end to switch off).
- Example achievable: "Fields on at 50% 10 minutes before, 100% at start, off 15 minutes after end."
- Profiles can be duplicated and edited.
- Profiles are listed in a Facilities admin view with name, zones, and last-modified date.
- Profiles are not tied to a specific event at creation; they are attached to Bookables or events separately.

---

### LAC-002 · Create an Access Profile
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to create an access profile so that I can define which doors or barriers are controlled for an event and who is authorised to unlock them.

**Acceptance criteria:**
- Access profile fields: name, doors/barriers covered, authorised identities (role, tag, registered-attendee, ticket-QR scan).
- Multiple authorisation criteria can be combined (e.g. role = Coach OR registered-attendee = true).
- Anti-passback toggle: prevents the same credential from entering twice without an exit scan.
- Overflow limit: respect the event's capacity — deny access when at capacity even with a valid credential.
- Profiles listed in Facilities admin view with name, doors, and authorisation summary.

---

### LAC-003 · Attach Profiles to a Bookable
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to attach a lighting profile and an access profile to a Bookable so that every event booked at that venue automatically inherits the correct physical behaviour.

**Acceptance criteria:**
- Each Bookable has a Lighting Profile field and an Access Profile field (both optional).
- Profiles attached to a parent Bookable are inherited by children unless overridden.
- Admin selects from a list of existing profiles; profiles cannot be created inline on the Bookable form.
- Changing a Bookable's profile affects future bookings only; existing generated schedules are not retroactively changed.
- Profile attachment change is logged in the Bookable's audit log.

---

### LAC-004 · Override Profile per Event or Session
**Status:** planned | **Priority:** medium

As a Club Admin or Facilities Admin, I want to override the default lighting or access profile for a specific event or session so that unusual events get the right physical setup.

**Acceptance criteria:**
- Event and each session have a Lighting Profile override field and an Access Profile override field.
- Override takes precedence over the Bookable's default profile for that event/session's schedule.
- Removing an override reverts the event/session to the Bookable's default.
- Override is shown clearly in the event's detail view (e.g. "Using custom lighting profile: Stadium Night Match").
- Override changes are logged against the event.

---

### LAC-005 · Auto-Generate Lighting and Access Schedules from Events
**Status:** planned | **Priority:** high

As a Facilities Admin, I want schedules to be generated automatically when an event is published so that I don't have to manually program lighting or access controllers.

**Acceptance criteria:**
- Schedule generation is triggered automatically when an event transitions to Published state.
- Schedules are built from: event/session date-time ranges + ramp-up/cool-down buffers from the lighting profile + access windows from the access profile.
- Overlapping bookings at the same venue are merged (union) into a single schedule — no gap between back-to-back events.
- Closure/deactivation windows on the Bookable are respected — conflicting closure periods raise a warning to the Facilities Admin.
- Schedules are delivered to the physical controller via the configured integration (webhook/REST/iCal).
- Generation completes within 60 seconds of event publication.
- Admin receives a notification if schedule generation fails (e.g. controller unreachable).

---

### LAC-006 · Manually Override Lighting from an Event
**Status:** planned | **Priority:** medium

As a Club Admin or Facilities Admin, I want to manually trigger or extend lighting from within an event's admin view so that I can handle on-the-day situations without touching the controller directly.

**Acceptance criteria:**
- Event detail view (and mobile app) exposes: "Turn on now" and "Extend by 30 minutes" actions for the event's lighting schedule.
- "Turn on now" immediately sends an activation command to the controller; lighting activates within 60 seconds.
- "Extend by 30 minutes" pushes the scheduled off-time forward by 30 minutes (repeatable).
- Manual override is logged against the event with actor and timestamp.
- Override expires at the new end time; normal schedule resumes afterwards.

---

### LAC-007 · Scan a QR / Ticket ID for Door Access
**Status:** planned | **Priority:** high

As a Coach or Facilities Admin, I want to scan a registrant's QR code or ticket ID at a door so that only registered participants can enter the event space.

**Acceptance criteria:**
- Scan point (mobile app or hardware reader) reads the ticket QR code or ticket ID.
- System validates the credential against the Registration record: checks that the registration is Confirmed and the scan is within the event's access window.
- Valid scan: door unlocks; scan logged as Grant.
- Invalid scan (not registered, cancelled, outside window, capacity full): door remains locked; scan logged as Denied with reason.
- Anti-passback enforced if enabled on the access profile: second entry without an exit scan is denied.
- Response time from scan to door decision is under 2 seconds.

---

### LAC-008 · Scan a Member Credential for Access
**Status:** planned | **Priority:** high

As a Coach or Facilities Admin, I want to scan a member's FM credential (card, fob, or app) at a door so that credentialed members can enter without a printed ticket.

**Acceptance criteria:**
- Member credential (NFC card, key fob, or in-app QR) is validated against the invitee/attendee list for the active event.
- Validation checks: credential belongs to an FM member AND that member is Confirmed for the event AND scan is within the access window.
- Valid: door unlocks; scan logged as Grant with member identity.
- Invalid: door remains locked; scan logged as Denied with reason (not on list, cancelled, not in window).
- Unknown credential: logged as Unknown and flagged in the access control report.

---

### LAC-009 · View the Access Control Scan Log
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to view a log of all scan events so that I can audit who entered and when, and investigate any incidents.

**Acceptance criteria:**
- Scan log shows: credential (person name or ticket ID), door, scan time, result (Grant / Denied / Unknown), and reason for denials.
- Log is filterable by event, door, result, date range, and person.
- Scan events are available in real time (no delay over 30 seconds).
- Export to CSV/XLSX available.
- Scan log feeds into the cross-module Access Control report (see Reporting area).

---

### LAC-010 · Configure a Hardware Integration
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to configure an integration between FM and a physical lighting or access controller so that schedules and access decisions are delivered automatically.

**Acceptance criteria:**
- Generic webhook/REST endpoint supported: admin supplies the controller's URL, authentication method (API key or OAuth), and payload format.
- Named integrations supported out of the box for: Philips Hue / DALI / KNX (lighting); HID, Paxton, Salto (access). Final v1 list confirmed during discovery.
- iCal fallback: for controllers that only accept calendar feeds, FM generates a subscribable iCal URL per Bookable.
- Integration configuration tested via a "Send test command" action before going live.
- Integration status (connected / unreachable) shown in the Facilities admin dashboard.
- Integration config changes logged.

---

### LAC-011 · Apply Fail-Safe and Safety Rules
**Status:** planned | **Priority:** high

As a Facilities Admin, I want the platform to maintain a safe physical state if it loses contact with a controller so that facility safety is never compromised by a software failure.

**Acceptance criteria:**
- If FM cannot reach a controller, lights and access hardware remain in their last known safe state (lights-on stays on, door-locked stays locked).
- FM does not retry controller commands indefinitely; after N failed attempts it logs a failure and alerts the Facilities Admin.
- A Facilities Admin can issue an emergency override from any device that immediately sends a safe-state command to all connected controllers for a specified Bookable.
- Emergency override is logged with actor, timestamp, and affected controllers.
- Safety rule enforcement is separate from and takes precedence over any pending schedule.

---

### LAC-012 · Emergency Override by Facilities Admin
**Status:** planned | **Priority:** high

As a Facilities Admin, I want to be able to override all access and lighting for a venue from any device in an emergency so that I can respond quickly regardless of the system's current schedule state.

**Acceptance criteria:**
- Emergency override action available in the Facilities Admin mobile and desktop views.
- Override options: "Lock all doors" / "Unlock all doors" / "Lights on" / "Lights off" per Bookable or per zone.
- Override takes effect within 10 seconds of activation.
- Override remains active until manually cancelled by a Facilities Admin.
- All emergency override events are logged in a separate security log (actor, timestamp, action, affected bookable).
- Normal schedule resumes after override is cancelled.
