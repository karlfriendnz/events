# Area: Reporting

**Key:** `REPORTING`
**Description:** A unified reporting layer that reads from every module. Covers 10 pre-built reports, a custom report builder, bulk actions on person-based results, role-based dashboards, scheduled report delivery, and data export. Also exposes a read API and webhooks for external integrations.

---

## User Stories

### REPORTING-001 · View the Attendance Report
**Status:** planned | **Priority:** high

As a Club Admin or Coach, I want to view an attendance report so that I can see who attended, by session, by person, and by group.

**Acceptance criteria:**
- Report dimensions: by event, by session, by person, by group, by category.
- Metrics: day-of arrival count, no-shows, percentage attendance.
- Filterable by date range, event, session, group, and category.
- Required-minimum logic surfaced: registrants who have not met their minimum attendance threshold are highlighted.
- Data is real-time during a live event (no caching delay over 30 seconds).
- Export to CSV/XLSX available.

---

### REPORTING-002 · View the Registration Funnel Report
**Status:** planned | **Priority:** high

As a Club Admin, I want to see how registrations progress through each lifecycle stage so that I can identify where drop-off occurs and improve conversion.

**Acceptance criteria:**
- Funnel steps shown: Views → Interest → Hold → Confirmed → Paid → Attended.
- Drop-off percentage shown between each step.
- Filterable by event, date range, and category.
- Funnel can be viewed as a chart and as a data table.
- Clicking a step drills into the list of registrants at that stage.

---

### REPORTING-003 · View the Financial Summary Report
**Status:** planned | **Priority:** high

As a Finance Admin or Club Admin, I want to see a financial summary report so that I can track revenue by fee component, add-on, category, and club.

**Acceptance criteria:**
- Revenue broken out by: fee component, add-on, event category, and club.
- NSO view shows rolled-up totals across all clubs.
- Xero reconciliation status shown per transaction line (Matched / Unmatched / Failed).
- Filterable by date range, event, club, component, and Xero status.
- Export to CSV/XLSX/PDF.

---

### REPORTING-004 · View the Discount Usage Report
**Status:** planned | **Priority:** medium

As a Club Admin or Finance Admin, I want to see how discounts are being used so that I can measure their impact and manage costs.

**Acceptance criteria:**
- Report covers all discount types: code-based, sibling, training-linked, role-based.
- Metrics per discount: redemption count, total value discounted, average discount per redemption.
- Code-based discounts show each code individually with its usage vs. cap.
- Filterable by discount type, event, date range.
- Export to CSV/XLSX.

---

### REPORTING-005 · View the Waitlist and Holds Report
**Status:** planned | **Priority:** medium

As a Club Admin, I want to see waitlist and hold-spot metrics so that I can understand demand beyond confirmed registrations.

**Acceptance criteria:**
- Metrics: current waitlist size per event, average wait time before promotion, promotion rate, hold expiry rate.
- Shows active holds with remaining expiry time.
- Filterable by event and date range.
- Clicking a waitlist entry links to the registrant's record.
- Export to CSV/XLSX.

---

### REPORTING-006 · View the Bookable Utilisation Report
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to see how heavily each bookable is being used so that I can optimise scheduling and identify underused or overused resources.

**Acceptance criteria:**
- Metrics: percentage booked per bookable by hour, day, and week.
- Conflict count per bookable shown.
- Filterable by bookable, date range, and category.
- Hierarchy-aware: parent shows aggregate utilisation of all children.
- Export to CSV/XLSX.

---

### REPORTING-007 · View the Access Control Report
**Status:** planned | **Priority:** medium

As a Facilities Admin, I want to see access control scan data across events so that I can identify patterns, anomalies, and denied-access incidents.

**Acceptance criteria:**
- Metrics: total scans by door, grant vs. denial ratio, unknown credential count.
- Denial reasons broken out: not registered, cancelled, outside window, capacity full.
- Filterable by event, door, date range, result.
- Clicking a scan record shows the full scan log entry.
- Export to CSV/XLSX.

---

### REPORTING-008 · View the Category Usage Report
**Status:** planned | **Priority:** low

As an NSO Admin or Club Admin, I want to see event and attendance counts per category so that I can understand which types of events are most popular.

**Acceptance criteria:**
- Metrics per category: number of events, total registrations, total attendance, year-over-year comparison.
- Drill-through from a category to the list of events in that category.
- Filterable by date range and club.
- Export to CSV/XLSX.

---

### REPORTING-009 · View the Refunds and Credits Report
**Status:** planned | **Priority:** medium

As a Finance Admin, I want to see all refunds and credits issued so that I can audit financial outflows and monitor refund patterns.

**Acceptance criteria:**
- Metrics: total refund value, total credit value, count of refunds, average time from registration to refund.
- Each row shows: registrant, event, refund type (cash/credit), amount, reason, processor, date.
- Filterable by event, date range, refund type, and processor.
- Export to CSV/XLSX/PDF.

---

### REPORTING-010 · View the Member Engagement Report
**Status:** planned | **Priority:** medium

As a Club Admin, I want to see how engaged each member is with events so that I can identify inactive members and target re-engagement.

**Acceptance criteria:**
- Metrics per member: number of events attended, date of last attended event, categories attended, inactive status flag (no attendance in last N days, configurable).
- Filterable by group, membership type, date range, and inactive status.
- Bulk-action toolbar available: message, add tag, add to group.
- Export to CSV/XLSX.

---

### REPORTING-011 · Build a Custom Report
**Status:** planned | **Priority:** high

As a Club Admin or NSO Admin, I want to build a custom report from scratch so that I can answer specific questions not covered by pre-built reports.

**Acceptance criteria:**
- Base entity selection: Event, Registration, Booking, Transaction, Scan.
- Columns can be added from related entities across modules (e.g. event title, registrant name, fee component amount, scan result).
- Filters use the FM Selector expression language.
- Grouping, pivoting, and aggregation supported (sum, average, count, distinct count).
- Custom reports can be saved with a name and shared with other admin users (with permissions).
- Report runs within 30 seconds for datasets up to 100,000 records.

---

### REPORTING-012 · Apply Bulk Actions on Report Results
**Status:** planned | **Priority:** high

As a Club Admin, I want to select rows in any person-based report and apply bulk actions so that I can act on a filtered segment without navigating away.

**Acceptance criteria:**
- Bulk action toolbar appears when one or more rows are selected.
- Available actions: message, add tag, add to group, refund, waitlist promote, generate tasks, export selection.
- Bulk message opens the FM Mailer compose flow pre-addressed to selected recipients.
- Actions are applied asynchronously for large selections; admin receives a completion notification.
- Actions are logged against each affected record.

---

### REPORTING-013 · View a Role-Based Dashboard
**Status:** planned | **Priority:** high

As any admin user, I want to see a dashboard tailored to my role so that the most important metrics are visible without navigating through reports.

**Acceptance criteria:**
- Dashboard variants for: NSO Admin, Club Admin, Coach, Finance Admin, Facilities Admin.
- Each dashboard shows role-relevant widgets (e.g. Finance Admin sees outstanding payments, Xero sync status; Coach sees upcoming sessions, today's attendance).
- Every widget drills through to the underlying report on click.
- Dashboard loads within 3 seconds for typical data volumes.
- Widgets use real-time or near-real-time data (maximum 5-minute cache).

---

### REPORTING-014 · Export a Report
**Status:** planned | **Priority:** high

As any admin user, I want to export any report to a file so that I can share data with stakeholders or import it into other tools.

**Acceptance criteria:**
- Export formats: CSV, XLSX, PDF.
- Export available on every pre-built report and every custom report.
- PDF exports include the report title, applied filters, generation date, and the FM club/NSO name.
- Large exports (over 10,000 rows) are processed asynchronously; admin receives an email with a download link.
- Download links expire after 48 hours for security.

---

### REPORTING-015 · Schedule a Report for Email Delivery
**Status:** planned | **Priority:** medium

As a Club Admin or NSO Admin, I want to schedule a report to be emailed to me on a recurring basis so that I receive key metrics without logging in.

**Acceptance criteria:**
- Any pre-built or saved custom report can have a schedule attached.
- Schedule options: daily, weekly (pick day of week), monthly (pick day of month).
- Delivery format: CSV, XLSX, or PDF attachment.
- Recipients can include FM users and external email addresses.
- Admin can pause, edit, or delete a schedule at any time.
- Scheduled delivery is logged; failed deliveries surface an alert to the report owner.

---

### REPORTING-016 · Access Data via the Read API
**Status:** planned | **Priority:** medium

As a third-party developer or integration partner, I want to query FM event data via a read API so that I can build external dashboards, automations, or data pipelines.

**Acceptance criteria:**
- Read API available for every core entity: Event, Session, Registration, Booking, Transaction, Scan, Member, Bookable.
- OAuth 2.0 authentication with configurable scopes (per entity type).
- Responses are paginated; page size configurable up to 1,000 records.
- API rate limiting applied per OAuth client with rate-limit headers in responses.
- API documentation published (OpenAPI spec).
- API access configurable per club by the NSO or Club Admin.

---

### REPORTING-017 · Configure and Receive Webhooks
**Status:** planned | **Priority:** medium

As a third-party developer or integration partner, I want to subscribe to FM webhooks so that my system is notified in real time when key events occur.

**Acceptance criteria:**
- Webhook events supported: registration created/updated/cancelled, payment received/refunded, scan (grant/deny), booking conflict detected.
- Admin configures webhook endpoints in the club's integration settings: URL, secret for payload signing, and events to subscribe to.
- Payloads are signed with HMAC-SHA256; signature included in the request header.
- Failed webhook deliveries are retried with exponential back-off (up to 24 hours).
- Delivery log shows each delivery attempt, response code, and retry status.
- Admin can manually replay a failed webhook delivery.
