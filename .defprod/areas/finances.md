# Area: Finances

**Key:** `FINANCES`
**Description:** The pricing engine used across Events, Sessions, Bookings, Registration Forms, and Add-ons. Covers fee components, conditional rule pricing, add-ons, deposits, instalments, discount types, early-bird/late fees, unique ticket numbers, payment method configuration, refunds, and Xero integration.

---

## User Stories

### FINANCES-001 · Configure Base Fee with Fee Components
**Status:** planned | **Priority:** high

As a Club Admin or NSO Admin, I want to configure a base fee with named components so that each portion of the total price maps to its own accounting code and locking rules.

**Acceptance criteria:**
- Base fee split into named components (e.g. Kit Fee, Qualification Fee, NSO Fee, Club Fee).
- Each component has: amount, Xero account code, and an editable/locked flag (locked by NSO, editable by club).
- Components sum to the displayed total on the registration form.
- At least one component is required; there is no upper limit on component count.
- Worked example achievable: Kit $225 (50% deposit, locked), Qualification $100 (locked), NSO $100 (locked), Club $575 (editable) = $1,000 total.
- Fee components are visible in financial reports broken out per component.

---

### FINANCES-002 · Add Add-ons to an Event
**Status:** planned | **Priority:** high

As a Club Admin, I want to add purchasable add-ons to an event so that registrants can buy optional extras during registration.

**Acceptance criteria:**
- Two add-on types supported:
  - Object add-ons: tracker items, merchandise, sub-events, bookable items (e.g. t-shirt, Parent's Night VIP ticket).
  - Field-value add-ons: a form field whose selected option carries a price (e.g. "Gluten-free +$10"; dropdown with three priced options).
- Each add-on has: name, price, Xero account code, stock limit (optional), refund policy, and visibility rules.
- Add-ons appear in the registration form's pricing preview and update the running total as selected.
- Admin can view add-on take-up in the financial summary report.

---

### FINANCES-003 · Configure Deposit and Instalment Schedule
**Status:** planned | **Priority:** high

As a Club Admin, I want to configure a deposit and instalment schedule so that registrants pay in milestones rather than all upfront.

**Acceptance criteria:**
- Deposit configurable as a percentage of a specific fee component (e.g. 50% of Kit Fee due at registration).
- Instalment schedule: define N payment milestones each with an amount (or percentage) and a due date.
- Automated reminders sent to registrants before each instalment due date (configurable lead time).
- Full payment is required by a configurable deadline before the event (e.g. 20 days before).
- Registrant's profile shows outstanding instalments and upcoming due dates.
- Missed instalments surface in an admin view with bulk-action options (message, suspend access, cancel registration).

---

### FINANCES-004 · Create Conditional Fee Rules
**Status:** planned | **Priority:** high

As a Club Admin or NSO Admin, I want to create conditional fee rules so that the system automatically applies the correct price to each registrant based on their profile, group, or timing.

**Acceptance criteria:**
- Rules are condition → price-modifier pairs; multiple rules are stackable.
- Supported conditions: group membership (in/not in), membership type, person type, role/permission, tag, form-field value, age range, gender, discipline, qualification/tracker, time window (early-bird or late fee).
- Price modifier types: flat amount, percentage of base, replacement (override the base entirely).
- Rules are evaluated at registration time in a configurable order; order drag-and-drop available in the admin UI.
- Registrant sees the calculated price (with a breakdown of applied rules) before confirming registration.
- Worked example achievable: the 6-group × 4-session tiered pricing matrix from §6.2 of the spec.

---

### FINANCES-005 · Configure Sibling Discount
**Status:** planned | **Priority:** high

As a Club Admin, I want to configure a sibling discount so that families with multiple children registering get an automatic reduction on subsequent registrations.

**Acceptance criteria:**
- Sibling discount configurable as a flat amount or percentage off the base fee for the second (and subsequent) sibling.
- System detects siblings by the FM family/household relationship on member profiles.
- Discount applies automatically when a second sibling is added to a registration in the same flow.
- Sibling discount is visible as a line item in the registration pricing summary.
- Discount usage tracked in the discount report.

---

### FINANCES-006 · Configure Training-Linked Discount
**Status:** planned | **Priority:** medium

As a Club Admin, I want to configure a discount that rewards attendance at linked training sessions so that I incentivise members to participate in preparatory training.

**Acceptance criteria:**
- Admin links one or more training events to a main event.
- Discount condition: registrant has attended N or more of the linked training sessions.
- Discount is automatically applied at registration if the condition is met; not applied and not shown if condition is not met.
- Admin can view which registrants qualified for the discount in the discount usage report.

---

### FINANCES-007 · Create Discount Codes
**Status:** planned | **Priority:** medium

As a Club Admin, I want to create discount codes so that I can offer targeted price reductions to specific groups without changing the published price.

**Acceptance criteria:**
- Code fields: code string, discount type (flat/percentage), usage cap (total uses), per-user cap, expiry date, eligibility filter (open or restricted to specific groups/roles).
- Registrant enters the code on the registration form; system validates and applies it in real time.
- Invalid codes (expired, exhausted, not eligible) show a clear error message.
- Code usage is logged: who used it, when, and on which registration.
- Admin can deactivate a code at any time.
- Discount usage report shows all codes, their redemption counts, and total value discounted.

---

### FINANCES-008 · Configure Role-Based Discounts
**Status:** planned | **Priority:** medium

As a Club Admin, I want to configure discounts that auto-apply to members with specific roles so that staff, volunteers, or board members receive their entitlement automatically.

**Acceptance criteria:**
- Discount condition: registrant holds a specified FM role or permission.
- Discount applies automatically at registration without requiring a code.
- Discount is visible as a line item in the registration pricing summary.
- Role-based discounts are stackable with other discount types (subject to evaluation order).

---

### FINANCES-009 · Set Early-Bird and Late-Fee Windows
**Status:** planned | **Priority:** medium

As a Club Admin, I want to define time-based pricing windows so that registrants who sign up early pay less and those who register late pay a premium.

**Acceptance criteria:**
- Admin defines N time windows, each with: opens at (date/time or days-before-event), closes at, and price modifier (flat or percentage).
- Windows are non-overlapping; validation prevents gaps or overlaps on save.
- Registration form displays the currently active price and the date/price of the next transition.
- If a registrant's registration spans a window transition (e.g. starts in early-bird but payment completes in standard), the price at registration-start is locked.
- Window configurations visible in the event's fee summary.

---

### FINANCES-010 · Enable Unique Ticket Numbers
**Status:** planned | **Priority:** medium

As a Club Admin, I want each registration to receive a unique ticket ID so that I can use it for access control and attendance scanning.

**Acceptance criteria:**
- Per-event toggle: "Generate unique ticket ID per registration."
- Ticket ID generated on registration confirmation; format configurable (prefix + sequential number).
- Ticket ID displayed on the registrant's confirmation email and in their FM profile event record.
- Ticket ID usable as an access-control credential at scan points (see Lighting & Access Control area).
- Admin can look up a registration by ticket ID.

---

### FINANCES-011 · Configure Payment Methods per Event
**Status:** planned | **Priority:** high

As a Club Admin, I want to select which payment methods are available for a specific event so that I can enforce the right payment channel per event type.

**Acceptance criteria:**
- Available payment methods: credit card, invoicing, direct debit, account credit.
- System default configurable at the club level; per-event override supported.
- Only enabled methods appear as options on the registration form payment screen.
- Example: one event allows invoicing and credit card; another is credit-card only.
- Payment method selection logged against each transaction for audit purposes.

---

### FINANCES-012 · Process a Refund to Account Credit
**Status:** planned | **Priority:** high

As a Finance Admin, I want to refund a registration as account credit so that the member can use the balance on future events without requiring a bank transfer.

**Acceptance criteria:**
- Refund action available on any confirmed/paid registration within the event's refund deadline.
- Default refund destination: account credit (held against the member's FM profile).
- Credit balance visible on the member's profile and usable at checkout for future events.
- Refund audit log entry created: reason (free text), amount, processor (admin who actioned it), timestamp.
- Xero reversal entry generated automatically for the refunded amount.
- Registrant notified by email when a refund is processed.

---

### FINANCES-013 · Process a Cash or Reverse-Charge Refund
**Status:** planned | **Priority:** medium

As a Finance Admin, I want to process a cash or reverse-charge refund when a registrant requests repayment to their original payment method.

**Acceptance criteria:**
- Cash/reverse-charge refund option available in addition to account credit (not the default).
- Admin selects refund type, enters reason, and confirms the amount (full or partial).
- Refund is recorded in the audit log with all details.
- Xero reversal entry generated.
- Registrant notified by email with refund amount and expected processing time.
- Partial refunds supported; remaining balance shown on the registration record.

---

### FINANCES-014 · Map Fee Components to Xero Account Codes
**Status:** planned | **Priority:** high

As a Finance Admin or Club Admin, I want to assign a Xero account code to every fee component and add-on so that transactions post to the correct ledger automatically.

**Acceptance criteria:**
- Every fee component and add-on has a Xero account code field.
- NSO-provided codes are pre-filled on shared events; club can override only if the NSO has permitted it.
- Event cannot transition from Draft to Published unless every fee component and add-on has a mapped Xero code.
- Validation error clearly identifies which components are missing codes.
- Code assignments are logged in the event audit log.

---

### FINANCES-015 · View Xero Reconciliation
**Status:** planned | **Priority:** high

As a Finance Admin, I want to see the reconciliation status of every FM transaction against Xero so that I can identify and resolve mismatches quickly.

**Acceptance criteria:**
- Reconciliation view shows all transactions with status: Matched, Unmatched, or Failed.
- Each matched transaction links to its Xero invoice/payment record.
- Unmatched transactions show the reason (e.g. missing Xero code, connection error).
- Failed transactions can be retried individually or in bulk.
- Reconciliation view filterable by event, date range, club, status, and fee component.
- Summary counters show total matched value, total unmatched count, and total failed count.
