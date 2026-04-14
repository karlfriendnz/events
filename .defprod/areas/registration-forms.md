# Area: Public Registration Forms

**Key:** `REG_FORMS`
**Description:** The externally-hosted and in-app registration experience. Covers the drag-and-drop form builder, standard and custom fields, conditional logic, multi-page layouts, the live pricing preview, T&C blocks, elective pickers, sibling registration, public and authenticated flows, the hold-spot form flow, category and event inheritance, and accessibility/localisation.

---

## User Stories

### REG_FORMS-001 · Build a Registration Form with Drag-and-Drop
**Status:** planned | **Priority:** high

As a Club Admin, I want to build a registration form using a drag-and-drop builder so that I can create a tailored data-capture experience without writing code.

**Acceptance criteria:**
- Form builder accessed from the event's Registration tab.
- Fields are dragged from a field palette into the form canvas.
- Fields can be reordered by drag-and-drop on the canvas.
- Form can be saved as a draft and previewed at any time.
- Preview renders the form exactly as a registrant will see it, on both desktop and mobile viewport.
- Builder auto-saves every 30 seconds to prevent data loss.

---

### REG_FORMS-002 · Add Standard Fields to a Form
**Status:** planned | **Priority:** high

As a Club Admin, I want to add standard fields to my registration form so that I capture the core participant information consistently.

**Acceptance criteria:**
- Standard fields available: first name, last name, date of birth, email, phone, address, emergency contact name, emergency contact phone.
- Standard fields are pre-configured with appropriate input type and validation (e.g. date picker for DOB, email format for email).
- Fields can be marked required or optional per form.
- Standard fields that already exist on the registrant's FM profile can be set to auto-fill from profile on authenticated flows.

---

### REG_FORMS-003 · Add Custom Fields to a Form
**Status:** planned | **Priority:** high

As a Club Admin, I want to add custom fields to a registration form so that I can capture event-specific information not in the standard FM profile.

**Acceptance criteria:**
- Custom field types supported: short text, long text, single select (dropdown/radio), multi-select (checkboxes), number, date, file upload, yes/no toggle.
- Each custom field has: label, help text, placeholder, required flag, and validation rules.
- Custom fields can be designated as event-only data (stored against the Registration record, not the Person profile) or person-data (updates the Person profile on successful registration).
- Custom fields are reusable across forms (save to a field library for re-use).

---

### REG_FORMS-004 · Configure Conditional Field Logic
**Status:** planned | **Priority:** high

As a Club Admin, I want to configure conditional logic on form fields so that the form adapts based on prior answers and only shows relevant fields to each registrant.

**Acceptance criteria:**
- Conditions supported: show/hide, require, and branch (redirect to a different form page) based on prior field answers.
- Multiple conditions can be combined with AND/OR logic.
- Conditions reference any field on the same or a prior page.
- Condition builder is a visual interface (no code required).
- Preview mode allows the form builder to test different input values and confirm the correct fields appear/hide.
- Conditional rules are evaluated client-side for instant feedback; re-evaluated server-side on submit for security.

---

### REG_FORMS-005 · Configure a Multi-Page Form
**Status:** planned | **Priority:** medium

As a Club Admin, I want to split a long registration form into multiple pages so that registrants are not overwhelmed by a single long scroll.

**Acceptance criteria:**
- Pages added and reordered in the form builder.
- Page titles and optional descriptions configurable.
- Progress indicator displayed to the registrant showing current step and total steps.
- Answers on completed pages are preserved when navigating back.
- Validation runs per page on Next; registrant cannot advance until the current page is valid.
- Form can have 1 to N pages with no hard limit.

---

### REG_FORMS-006 · Display Live Pricing Preview
**Status:** planned | **Priority:** high

As a Member or Public Registrant, I want to see a live pricing summary that updates as I select sessions and add-ons so that I know the exact cost before submitting.

**Acceptance criteria:**
- Pricing preview section is a built-in form section, not a custom field.
- Summary updates in real time as the registrant selects optional sessions, add-ons, and electives.
- Summary shows: base fee, each fee component, each selected add-on, any discounts applied, and the total.
- Early-bird or late-fee pricing is reflected live based on the current date/time.
- If a discount code is entered, the discount line is shown immediately after validation.
- Final price shown in the registrant's local currency (configured per club).

---

### REG_FORMS-007 · Add Terms & Conditions Block
**Status:** planned | **Priority:** high

As a Club Admin, I want to include a Terms & Conditions block on the registration form so that registrants must acknowledge T&Cs before submitting.

**Acceptance criteria:**
- T&C block is a built-in form section with a rich-text T&C display area and an "I agree" checkbox.
- T&Cs default to the club or category default; can be overridden per event.
- Registrant cannot submit the form without ticking the checkbox.
- The agreed T&C version (content hash or version ID) is stored on the Registration record for audit.
- T&C block position on the form is fixed at the end (before payment), not drag-and-droppable.

---

### REG_FORMS-008 · Configure an Elective Picker
**Status:** planned | **Priority:** high

As a Club Admin, I want to include an elective picker section in my form so that registrants must choose one (or more) options from a set of elective sessions.

**Acceptance criteria:**
- Elective picker is a built-in form section configured from the event's session list.
- Admin specifies: minimum and maximum selections, which sessions are elective options, and any restrictions per option.
- Registrant sees the available elective sessions with descriptions and fees; selects within the min/max bounds.
- Pricing preview updates as electives are selected.
- Worked example achievable: "Day 5 — choose 1 of 6 electives" from the 5-Day Camp scenario.
- Elective selections are stored on the Registration record and visible in attendee reports.

---

### REG_FORMS-009 · Configure Sibling Registration in One Flow
**Status:** planned | **Priority:** high

As a Club Admin, I want to allow registrants to add siblings in the same registration flow so that families can register multiple children at once and automatically receive sibling discounts.

**Acceptance criteria:**
- Registrant can click "Add another participant" at any point in the form to register a sibling.
- Each sibling has their own instance of the form fields (pre-filled where profile data exists).
- Sibling discount is detected and applied automatically when a second sibling is added.
- Each sibling's registration is stored as a separate Registration record linked to a shared transaction/order.
- Payment is collected once for the combined total.
- Confirmation email lists all siblings registered and their individual fees.

---

### REG_FORMS-010 · Register as a Public (Unauthenticated) User
**Status:** planned | **Priority:** high

As a Public Registrant, I want to register for a public event without creating an FM account so that I can participate without friction.

**Acceptance criteria:**
- Public registration form is accessible via the event's public URL without login.
- Identity fields (name, email, phone) are collected in the form.
- If the email address matches an existing FM member, the event is surfaced in their FM app post-registration (no merge prompt during registration).
- Payment is collected as part of the form flow.
- Confirmation email sent to the provided email address.
- Optional: after successful registration, a prompt invites the registrant to create an FM account for future convenience (not required to complete the current registration).

---

### REG_FORMS-011 · Register as an Authenticated FM Member
**Status:** planned | **Priority:** high

As an FM Member, I want to register for an event while logged in so that my profile data auto-fills and I don't have to re-enter information I've already provided.

**Acceptance criteria:**
- Authenticated registrant is identified automatically; name, DOB, email, and other standard fields auto-fill from their FM profile.
- Auto-filled fields are still editable in case of outdated data.
- Person-data fields updated by the registrant during registration are written back to the FM profile on successful submission.
- Any applicable conditional fee rules (role, membership type, group) are evaluated against the authenticated user's profile automatically.
- Confirmation email sent and registration visible in the member's FM profile event history.

---

### REG_FORMS-012 · Purchase Guest Tickets
**Status:** planned | **Priority:** medium

As a Member or Public Registrant, I want to purchase tickets for guests who don't have an FM account so that I can bring people who are not members to an event.

**Acceptance criteria:**
- Guest ticket option available only when the event admin has enabled it.
- Registrant specifies: guest name, email, and any custom fields required per the form config.
- Max-guests-per-registrant limit enforced.
- Each guest ticket counts against event capacity.
- Guest receives a confirmation email with their ticket details.
- Guests appear in the attendee list as guest entries linked to the registrant who purchased them.

---

### REG_FORMS-013 · Complete the Hold-Spot Form Flow (Minor Registration)
**Status:** planned | **Priority:** high

As a Minor or a parent registering a minor, I want to submit a registration that creates a hold so that a spot is reserved while a parent confirms.

**Acceptance criteria:**
- Hold-spot flow triggered when: the event has hold-spot enabled AND the registrant is below the configured age threshold.
- Form collects parent/guardian email as a required field before submission.
- On submission, registration is saved with Hold (24h) status; spot is reserved immediately.
- Parent/guardian receives a branded confirmation email with a secure confirmation link and 24-hour expiry.
- Confirmation link opens the payment and confirmation screen with pre-filled registration data.
- On successful parent confirmation, registration transitions to Confirmed and payment is collected.
- On expiry: spot released, child moved to Waitlisted (if event is full), child notified.

---

### REG_FORMS-014 · Parent/Guardian Confirms a Hold-Spot
**Status:** planned | **Priority:** high

As a Parent/Guardian, I want to confirm my child's registration via the link emailed to me so that their spot is secured before the hold expires.

**Acceptance criteria:**
- Confirmation link works without requiring a login to FM (public URL with a secure token).
- Link displays: event details, child's name, selected sessions, and total fee.
- Parent reviews and accepts T&Cs (if not already accepted by the child).
- Parent completes payment (or defers to invoice if invoicing is enabled).
- On completion: registration transitions to Confirmed; parent receives a confirmation email; admin hold queue updates.
- Expired links show a clear message and offer a waitlist option if the event still has capacity.

---

### REG_FORMS-015 · Inherit and Override Forms from Category
**Status:** planned | **Priority:** medium

As a Club Admin, I want events to inherit the default registration form from their category so that I don't have to configure a form from scratch for every event.

**Acceptance criteria:**
- Each category can nominate a default registration form.
- New events in that category automatically use the category's default form.
- Admin can override the category form per event: either replace it entirely with a new form or duplicate the category form and edit the copy.
- Editing the category default does not affect events that have already overridden the form.
- Events that still use the inherited form display a badge ("Using category default") and a link to customise.

---

### REG_FORMS-016 · Ensure Accessibility and Localisation
**Status:** planned | **Priority:** high

As a Public Registrant or Member, I want the registration form to be accessible and displayed in the correct language and currency so that I can complete registration regardless of ability or location.

**Acceptance criteria:**
- All public-facing registration form pages meet WCAG 2.2 Level AA.
- Language/locale configurable per club; form labels, error messages, and T&Cs render in the configured locale.
- Currency symbol and formatting match the club's configured currency.
- All form inputs are keyboard-navigable.
- Error messages are associated with their fields for screen-reader compatibility.
- Date pickers fall back to text input with a clear format hint on devices that don't support native date inputs.
