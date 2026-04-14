# Product Brief — FriendlyManager Events Platform

---

## Description

FriendlyManager Events Platform is an integrated sports organisation management system that handles the full lifecycle of events — authoring, bookings, participant registration, payments, physical access control, and cross-module reporting. It serves National Sports Organisations (NSOs) and their affiliated clubs, enabling NSOs to author events once and distribute them to clubs with controlled overrides, while supporting the full registration journey from interest through attendance and reporting.

---

## Problem

### Summary

Sports organisations manage events across disconnected systems — spreadsheets, third-party ticketing tools, physical booking logs, and accounting software — creating data silos, manual reconciliation burden, and a fragmented experience for participants.

### Context

FriendlyManager already provides membership, groups, and communications tooling. The events domain is handled by an older, limited module that cannot express modern requirements: tiered conditional pricing, parent-confirms-for-child hold flows, NSO-to-club event distribution, physical access control tied to event state, or cross-module analytics. Clubs running programs like multi-day camps must cobble together multiple tools and manually reconcile the results.

### Impact

Without this platform, NSOs cannot enforce consistent fee structures or Xero codes across affiliated clubs. Clubs lose revenue to undetected double-bookings and abandoned registrations. Parents face friction registering children through disconnected flows. Finance admins spend hours reconciling payments that should be automatic. Facilities sit idle because booking state doesn't drive lighting or access automatically.

---

## Users

### NSO Admin
National Sports Organisation administrator who authors master events, sets financial defaults, distributes events to affiliated clubs, and requires consolidated cross-club reporting.
- **Goals:** Author once, distribute to many; enforce fee compliance; see rolled-up attendance and financial data.
- **Pain points:** Clubs override pricing incorrectly; Xero codes are inconsistent; no single view of cross-club event performance.

### Club Admin / Event Coordinator
Runs day-to-day event operations for a single club — accepts shared events, creates club-specific events, manages attendees and finances.
- **Goals:** Fast event setup; override what needs overriding without breaking NSO defaults; mobile access for simple events.
- **Pain points:** Multi-step fee configuration is complex; conflict detection on venues requires manual checks; registration status scattered across tools.

### Coach / Session Lead
Runs individual sessions, takes attendance, manages session-level invitee lists.
- **Goals:** Fast attendance capture on mobile; clear view of who should be at each session.
- **Pain points:** Attendee lists don't update when group membership changes; no mobile-friendly attendance UI.

### Member (Parent / Player)
Registers self or children for events, pays fees, tracks attendance across family members.
- **Goals:** Clear pricing upfront; stable registration link; visible waitlist position; single flow to register multiple family members.
- **Pain points:** Surprise fees at checkout; unclear hold-spot expiry; no sibling discount applied automatically.

### Public Registrant
Non-member who registers via a public URL for an externally-advertised event.
- **Goals:** Complete registration without creating an account; clear pricing; confirmation on payment.
- **Pain points:** Forced account creation before seeing pricing; no live capacity indicator.

### Finance Admin
Reconciles payments, manages refunds, maps fee components to Xero chart-of-accounts codes.
- **Goals:** Accurate Xero codes per fee component; automated invoice sync; clear refund audit trail.
- **Pain points:** Clubs publish events with unmapped fees; refunds issued outside the system break reconciliation.

### Facilities Admin
Owns venue bookables, lighting profiles, and access control configuration.
- **Goals:** Zero double-bookings; automatic lighting/access driven by event state; emergency override from any device.
- **Pain points:** Lights left on after events; door access not revoked when registration is cancelled; conflict detection is manual.

---

## Requirements

1. Support seven event styles: Basic, Advanced, Multi-Session, Sports Competition Entries, Holiday Program/Camp, Attendance (Class), and Competition.
2. Provide a hierarchical event model: Event → Session → Sub-session, where each level inherits and can override parent properties.
3. Support recurring events with weekly, monthly, annual, and fully custom recurrence patterns and scoped edit (this / all future / all).
4. Allow invitees to be selected via the FM Selector: individuals, system groups, roles, tags, disciplines, and dynamic filter expressions.
5. Support seven invitee statuses: Invited, Confirmed, Declined, Excluded, Interested, Hold (24h), Waitlisted.
6. Enforce configurable capacity limits per event and per session with automatic waitlist promotion when a spot opens.
7. Implement a hold-spot flow where a minor's registration triggers a 24-hour parent confirmation window before a spot is secured.
8. Support phased registration windows: member-exclusive followed by public access, configurable per event, per category, or inherited from NSO defaults.
9. Enable NSO-to-Club event sharing with configurable locked vs. overridable fields per fee component; clubs must map Xero codes before publishing.
10. Provide a Bookable primitive covering Venue, Person, and Item types with parent/child hierarchy (up to 8 levels) and Master/Slave cloning.
11. Detect hard booking conflicts (same Bookable already booked) and soft conflicts (sibling bookings exhausting capacity); allow admin password override.
12. Implement a conditional fee rule engine supporting group, membership, role, tag, field-value, age, gender, discipline, qualification, and time-based conditions, with stackable evaluation order.
13. Support fee components (Kit, Qualification, NSO, Club) each with independent Xero codes and lock/editable flags.
14. Support add-ons (object and field-value types), deposits (percentage of component), and instalment schedules with automated reminders.
15. Implement four discount types: sibling, training-linked, code-based (with caps and expiry), and role-based; stackable with configurable evaluation order.
16. Provide a drag-and-drop public registration form builder with standard fields, custom fields, conditional logic, multi-page layout, and a live pricing preview.
17. Support both authenticated (FM member) and unauthenticated (public) registration flows.
18. Integrate with physical infrastructure: generate lighting and access control schedules automatically from event/session times and attached profiles.
19. Validate QR/ticket-ID scans against registration records for door access; log all scan events.
20. Provide a reporting layer with 10 pre-built reports, a custom report builder, bulk actions on person-based results, role-based dashboards, and CSV/XLSX/PDF export.
21. Log every create/edit/delete with actor, timestamp, and before/after values; surface a separate security log for payments, refunds, and access overrides.
22. Send notifications (email and in-app) at key registration milestones: invitation, hold created, hold expiring, payment due, waitlist promotion, refund window closing.
23. Support CSV import of external events with a field mapper and validation preview.
24. Expose a read API for every entity (OAuth-scoped) and webhooks for registration, payment, refund, scan, and conflict events.

---

## Success Criteria

1. An NSO admin can author a master event with tiered fee components and share it to 10+ clubs in under 15 minutes, with Xero-code compliance enforced before any club can publish.
2. A club member can complete the full registration flow — including session selection, sibling registration, discount application, and payment — without contacting club staff.
3. Zero double-bookings reach the published state without an explicit admin password override.
4. Lighting and access schedules are generated automatically within 60 seconds of an event being published, with no manual Facilities Admin action required.
5. The hold-spot flow correctly reserves a spot, notifies the parent, and releases it on expiry in 100% of test cases, with no spot leaked to other registrants during the 24-hour window.
6. Every published event has a fully mapped Xero code for every fee component — events with unmapped codes cannot transition to published state.
7. Attendance reports are available in real time during a session, with bulk-action toolbar enabling message, tag, and waitlist-promote in a single selection.
8. A public registrant with no FM account can complete registration and payment for a public event in under 5 minutes.
9. The custom report builder can produce any cross-entity report (Event × Registration × Transaction × Person) within 30 seconds for datasets up to 100,000 records.
10. The platform achieves WCAG 2.2 AA compliance on all public-facing registration form pages.

---

## Out of Scope (v1)

- Full social-media auto-publishing (Facebook, Instagram, LinkedIn).
- Bi-directional Google / Apple / Microsoft calendar sync.
- Mobile-app authoring for Advanced, Multi-Session, Holiday Program, and Competition event styles.
- Survey automation triggered by attendance.
- AI-assisted natural-language event setup.
- Dynamic demand-based pricing.
- Live-streaming integration and paywalls.
- Public Bookable Network (cross-club venue discovery).
- Sponsor/advertising marketplace on public event pages.

---

## Aesthetics

### Tone
Professional and efficient — the platform serves sports administrators who value speed and accuracy over decoration. Language should be direct, jargon-free, and action-oriented. Error messages should explain what went wrong and what to do next.

### Style
- Dense information layouts with progressive disclosure (summary → detail on demand).
- Mobile-first for attendance and scan flows; desktop-optimised for event authoring wizards.
- Consistent use of status badges, colour-coded by state, across all modules.
- Inline validation with immediate feedback; no full-page reloads on form submission.
- Data tables with sticky headers, sortable columns, and bulk-action toolbars.

### Principles
1. **Inheritance over repetition** — defaults flow from NSO → Category → Event → Session; users configure exceptions, not rules.
2. **Guard rails, not gates** — warn before blocking; allow admin overrides with intentional friction (password confirmation), not hard locks.
3. **Real-time state** — capacity counts, waitlist positions, and payment statuses reflect live data, not cached snapshots.
4. **Audit everything** — every state change is logged with full context; nothing is silently overwritten.
5. **Mobile where it matters** — attendance, scan, and basic-event flows are first-class on mobile; complex authoring is desktop-only.

---

## References

- Product specification: `FriendlyManager_Events_Upgrade_Spec.md`
- Onboarding document: `docs/defprod-onboarding.md`
- Figma prototype (Pink Zebra): referenced in spec §0 — see spec file for URL
