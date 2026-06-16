# FriendlyManager Platform Audit

> Purpose: a complete functional inventory of the existing FriendlyManager platform
> (mapped live from `demoswimming.friendlymanager.com`, a Swimming-club demo tenant),
> to drive the rebuild that folds in the enhanced `fm-events` events system.
> Design is explicitly out of scope — this records **what each page does**, its fields,
> actions, and the data it implies.

**Tenant:** Demo - Swimming · logged in as `FriendlyWeb` (admin/super role; has "Switch Role").
**Audit method:** Playwright crawl — every page, every option, with create/edit/delete tested on labelled test data (`ZZTest…`).
**Status legend:** ☐ not started · ◐ in progress · ☑ done

---

## Top-level navigation (sidebar)

| Module | URL | One-liner | Audit |
|---|---|---|---|
| People | `/people` | Members / Staff / Contacts / Other directory (82 records) | ◐ |
| Squads | `/groups` | Training squads / groups | ☐ |
| Fees | `/fees` | Billing, outstanding fees, invoicing | ☐ |
| Events | `/events` | Events / meets / sessions | ☐ |
| Attendance | `/attendance` | Attendance tracking | ☐ |
| Mailer | `/email` | Bulk email / communications | ☐ |
| Awards | `/awards` | Awards / badges / certificates | ☐ |
| Resources | `/resources` | Documents / resource library | ☐ |
| Uniforms | `/assets` | Uniform / asset inventory | ☐ |
| Programmes | `/programs` | Programmes (learn-to-swim style) | ☐ |
| Club Settings | `/settings` | Org/club configuration | ☐ |
| Help | `/help` | Help/support | ☐ |
| Switch Role | — | Role-switcher (multi-role accounts) | ☐ |

**Global chrome:** top search box; Help / Club Settings / Logout icons; club logo+name; "Welcome, {name}".

## Dashboard (`/`)

- **Members** widget: donut — Members 18 / Staff 12 / Contacts 51 / Other 20 = **82 total**. Links to `/people`.
- **Finance** widget: "Outstanding Fees: $49,000.50" + weekly trend chart (26 May → 16 Jun). Links to fees.
- **Upcoming Events** widget: table (empty in this snapshot).
- **Term transfer banner:** "2026 Term 1 is open for transferring members from 2025 Term 1" → `Begin Transfer` (`/groups/termtransfer/19`) / `Dismiss`. ⇒ implies a **terms** concept tied to Squads, with member roll-over between terms.
- **Email-error banner:** lists people with bouncing email addresses (links to person records). ⇒ implies email deliverability tracking on person records.

---

<!-- Module sections appended below as the crawl proceeds -->

## Full sub-page sitemap (harvested from in-app submenus)

- **People** `/people`: `/people/new`, `/register`, `/people/membership` (Membership Length Report), `/people/duplicates` (Duplicate Names), `/people/preset/player-*` (saved column-view presets: Gender, Medical Report, Test, …)
- **Squads** `/groups`: `/groups/new`, `/groups/terms` (Terms), `/groups/codes` (Codes), `/groups/waitlist` (Waitlist), `/groups/allocator` (Squad Allocation), `/groups/members` (Members Report), `/groups/announcement` (Squad Announcement), `/groups/report` (Squads Report), `/groups/retention` (Retention Report), `/groups/termtransfer/:term`
- **Fees** `/fees`: `/fees/transactions`, `/fees/term-fees`, `/fees/report` (Term Fee Report), `/fees/outstanding` (Outstanding Balances), `/fees/overdue` (Overdue Report), `/fees/nofees` (Missing Fees Report), `/fees/recurring` (Recurring Report), `/fees/xero-config` (Xero Config)
- **Events** `/events`: `/events/new`, `/venues` (Venues & Bookings)
- **Attendance** `/attendance`: `/attendance/new`, `/attendance/report`, `/attendance/nonattendance` (Non Attendance Report), `/attendance/hours` (Coach Hours), `/attendance/visitors` (Visitors)
- **Mailer** `/email`: `/email/history`
- **Awards** `/awards`: `/awards/groups` (Award Groups), `/awards/report-award` (Award Report)
- **Resources** `/resources`
- **Uniforms** `/assets`: `/assets/report`
- **Programmes** `/programs`: `/programs/report`
- **Settings** `/settings` · **Help** `/help` · **Register (public)** `/register`

---

## 1. People (`/people`) ☑ list + profile

**List page:** filter tabs **All / Members / Contacts / Staff / Other / New**. DataTable: entries/page (10/20/50/All), per-column search, sortable, pagination. **Configurable columns** (also the person field set): Name, Member Squads, Coach Squads, Role, DOB, Age, Email, Gender, Phone, Alternate Phone, Address/Street/Suburb/City/Post Code, Notes, Tags, Primary/Emergency/Standard Contact, Medical, Join Date, Subscribed, Allow Photos, Restricted, **custom fields** (e.g. "School Year [custom]"). Saved column-views = **presets** (`/people/preset/...`). Top actions: **Register Members** (`/register`), **Email New Logins**.

**Person profile (`/people/:id`)** — tabbed: **Profile / Awards / Resources / Fees / Uniforms / Events / Attendance / Membership**.
- **Profile form fields:** `firstName, lastName, role` (No Login / Standard User / Roll Taker / Manager / Committee / Financial Admin / Club Admin), `email, phone, alternatePhone, gender` (Male/Female), `dateOfBirth, joinDate, street, suburb, city, postCode, medical` (textarea), `allowPhotos` (checkbox), `tags[]` (multi-select), **customFields[...]**, `notes` (internal, not user-visible), `subscribed` (newsletter).
- **Contacts** (sub-records, N per person): firstName, lastName, relationship (e.g. Father/Mother), **type** (Primary Contact / Standard Contact / Emergency Only), email, phone, alternatePhone, **relatedComms** (receive emails on behalf of member). ⇒ parent/guardian model; contacts can be shared & reused ("Attach Existing", "New member with these contacts").
- **Profile actions:** Edit / Save, **Add Credit**, **Purchase Merchandise** (`/register?form=4&user=:id`), **Assign Award / Create Award**, **Re-register** (`/register?user=&p[]=`), Restrict Registrations, **Archive Profile**, **Delete Profile**.
- **Fees tab:** invoices table (#, Name, Date, Due Date, Amount, Paid, Outstanding), payments/transactions (Date, Method, Reference, Amount), credits/refunds.
- **Uniforms tab:** issued assets (Item, Option, Item ID, Status, Date, Return, Note).
- **Membership tab:** full **Squad × Term** history (Squad, Term, Term Start, Term End, Coach) — 24 rows back to 2016; terms list: 2026 T1, 2025 T1, 2024, 2023, 2022 T1-3, 2021 T1-2, 2020 …, plus "Expression of Interest" pseudo-terms (EOI).

**Rebuild implications:** person = rich profile + role-based system access + reusable contacts (guardians) + tags + custom fields + per-term squad membership history + per-person financial ledger + issued-asset history + awards + event/attendance history. Newsletter subscription + photo-consent + medical are first-class.

## 2. Squads (`/groups`) ☑

Squads = the general **group** construct (training squads, plus Billing Groups, Volunteers, Meet groups, EOI). Landing groups squads by **weekday**; each card shows **Head coach / Members count / Waitlist count**. Sample squads: Club Night Squad B/C/D, Primary/Secondary School Kids Competitive, Adult Competitive, Learn to Swim, Competitive Juniors, Adult Learn to Swim.

**New squad form:** `codeID` (a reusable **Code** template — see below), `name`, `public` (show on website/signup form), `startAge`/`endAge`, `gender` (Mixed/Male/Female), `playersPerStaff` (members per coach), `limit` (member cap → drives waitlist).

**Sub-pages:**
- **Terms** (`/groups/terms`) — tabs Current/Past/All; **Add Term**. Term = `name, start, end, signupOpenDate, signupCloseDate, preOpenDate` (priority open + email). Columns: Name, Set, Start/End, Signup Open/Close, Priority Open & Email, Members. 16 terms back to 2016. ⇒ **Terms are the registration-window spine**: each term has a public signup window + priority pre-open; members roll over term-to-term (Term Transfer on dashboard).
- **Codes** (`/groups/codes`) — squad templates/categories reused across terms (a squad in 2025 T1 and 2026 T1 sharing a Code is "the same squad" across time).
- **Waitlist** (`/groups/waitlist`) — waitlisted members (driven by squad `limit`).
- **Squad Allocation** (`/groups/allocator`) — assign members to squads.
- **Members Report** (`/groups/members`), **Squads Report** (`/groups/report`), **Retention Report** (`/groups/retention`), **Squad Announcement** (`/groups/announcement` — message a squad).
- **Term Transfer** (`/groups/termtransfer/:term`) — bulk roll members from one term to the next.

**Rebuild implications:** Squad = group with code-template + age/gender constraints + capacity/waitlist + per-coach ratio + public-signup flag. **Term** is a cross-cutting entity with registration windows that gates signup; membership is (person × squad × term). This maps onto fm-events' member-groups but adds Terms, Codes, Waitlist, Allocation, Retention.

## 3. Events (`/events`) ☑ — **the module being enhanced**

**Landing = a calendar** (FullCalendar-style: month/week/list, today nav). Events are **category-colour-coded**; category filter with Select All/Deselect + **Manage** (5 categories). Events seen: recurring training sessions (Dolphins-Tuesday-4pm…), squad sessions, team/meet events (Womens Premier Team, Sharks). **New Event** button.

**Legacy New Event form (`/events/new`) — deliberately basic:**
`name` (title), `status`/visibility (**Invitees / All members / Public**), `location` (free-text venue string), `date+startTime`, All Day, `endDate+endTime`, `closeDate` (Invites Close), `maxAttendees`, single `fee` + `feeDue`, `notes`/Additional Info (rich text + image + embedded link), `personID` (Coordinator), `notifications` (Off / Notes & response changes / All responses).

Event detail (existing) handles **RSVP/invitee responses** + attendance (per the person profile's Events/Attendance tabs).

> **This is the gap the rebuild closes.** The legacy event = title + date + free-text location + one fee + invite list + RSVP. The `fm-events` prototype replaces it with: multi-**session** events, **registration forms** (FormBuilder), **ticket types**, **discounts**, **bookable venue** integration, invitee groups, **automation**, **reporting**, attendance check-in. See CLAUDE.md `/events/:id` tab breakdown. Rebuild = legacy Events module → `fm-events` events engine.

## 4. Venues & Bookings (`/venues`) ☑ — maps to `fm-events` booking engine

Two sections: **Venues** and **Staff (Private Lessons)**. Actions: **New Venue**, **New Staff**, **Book**.
- Venues are hierarchical: "Whole Pool" → "Lane One" / "Lane Two" (**sub-venues/lanes**); "Kids pool" (with description "0.4m deep learn to swim pool").
- Staff = bookable people for private lessons (e.g. "Gemma Adams — High performance individual coaching").

⇒ Legacy already has the **VENUE + sub-venue + PERSON(staff)** bookable model and a booking flow. `fm-events`' booking engine (bookables, activities, modes, configurations, scheduler/wizard/item flows, access control) is the **enhanced** version of this. Rebuild = legacy `/venues` → `fm-events` bookables/activities/modes.

## 5. Register (public) (`/register`) ☑ — maps to `fm-events` forms + public booking

Multi-step public registration **wizard** (steps 1→3→5…). **Forms are numbered/parameterised** (`/register?form=N&user=ID`): member registration, **merchandise purchase** (form=4), re-register (`?user=&p[]=`), EOI. Drives term signup (gated by Term signup windows) and squad selection + payment. ⇒ Maps to `fm-events` `<FormBuilder>` / `registration_forms` + public booking flow, but legacy ties registration tightly to **Terms + Squads + Fees** (a member registers *into a term/squad and is invoiced*).

## 6. Fees (`/fees`) ☑

Invoicing/billing ledger. Landing = invoice list (#, Name, Date, Due Date, Amount, Paid, **Outstanding/To-Pay**), tab `#unpaid`. Actions: **Add Fee**, **Add Credit**, **Email Statements**. Sub-pages: **Transactions** (payments), **Term Fees** (fees attached to a term/squad), **Term Fee Report**, **Outstanding Balances**, **Overdue Report**, **Missing Fees Report** (members with no fee), **Recurring Report** (recurring fees), **Xero Config** (accounting sync). ⇒ Full club billing: term-based + ad-hoc fees, credits, payments, statements, **Xero integration**, recurring billing. Per-person ledger lives on the profile Fees tab.

## 7. Attendance (`/attendance`) ☑

Roll-taking. Landing list (Name, Date/Time, Group, Attended). Actions: **Generate** (auto-create attendance sheets from squad class-times), **New Attendance**. Sub-pages: **Report**, **Non Attendance Report** (absentees), **Coach Hours** (staff hours from sessions), **Visitors** (drop-in/visitor tracking). ⇒ Per-squad-session attendance + coach payroll hours + visitor logging. Maps to `fm-events` attendance + the member-group training-event model.

## 8. Mailer (`/email`) ☑

3-step bulk email composer (**Setup → Content → Send**). Recipients: **Custom** selection / **Newsletter Subscribers** / squads / contacts ("Add All", "Contacts"), **CC Myself**, Subject, **Reply To**, **Attachments**. Sub-page **History** (`/email/history`). Honors the per-person `subscribed` flag + bounce tracking (dashboard email-error banner). ⇒ Club comms / newsletter tool.

## 9. Awards (`/awards`) ☑

Badge/certificate definitions: **Image, Name, Category, Description**, organised into **Award Groups** (e.g. "Club Night"). Actions: **Add**, **Assign** (to members). Sub-page **Award Report**. Assigned awards show on person profile Awards tab. ⇒ Achievement/badge system.

## 10. Resources (`/resources`) ☑

Document/file library. **Add Category** + **Add Resource** (View Details). Shared to members (person profile Resources tab). ⇒ Club document repository with categories + member visibility.

## 11. Uniforms / Assets (`/assets`) ☑

Inventory: **Name, Merchandise, Customise, Notes, Stock**. **New Uniform**. Items can be flagged **merchandise** (purchasable via `/register?form=4`), **customisable** (options/sizes), **stock-tracked**, and **issued/returned** to members (profile Uniforms tab: Item, Option, Item ID, Status, Date, Return, Note). Sub-page **Report**. ⇒ Asset/uniform inventory + merch sales + issue/return lifecycle. (Distinct from `fm-events` item *rentals* — this is sales+issue, but overlaps on inventory/stock.)

## 12. Programmes (`/programs`) ☑

**Holiday Programmes** — date-ranged bookable camps/clinics (**Name, Dates, Bookings Open**). **New Programme** + **Discounts** sub-tab + **Report**. ⇒ Maps to the `HOLIDAY_PROGRAM` event style; a bookable programme with its own signup window + discounts.

## 13. Club Settings (`/settings`) ☑

Config hub — tabs:
- **Club Info** (`#info`): name, phone, email, address, suburb, city, website, **logo / header / backdrop** images, login-help text.
- **Main Settings** (`#settings`): gender options, **colours**, class-times, attendance config (sign, columns, missed), assets-manager, **module toggles** (`module-awards / module-program / module-venues / module-assets / module-merchandise / module-resources`), staff-hours, vaccine-pass. ⇒ modules are switched on/off per club.
- **Terminology** (`#terminology`): rename core nouns — `player` / `players` (what a member is called), etc.
- **Registration** (`#signup`): public-facing **forms** (form-1…form-5), **login** page, **events-calendar** embed, **booking** embed — configurable signup/embeds.
- **Financial** (`#finance`): payment methods, fee config.
- **Emails** (`#emails`): email templates.
- **Sponsors** (`#sponsors`): sponsor logos.
- **Integrations** (`#integrations`): third-party (Xero, etc.).
- **Vouchers** (`#vouchers`): discount/voucher codes.
- **Custom Fields** (`#fields`): define per-person custom fields (e.g. "School Year").
- **FM Admin** (`#root`): FriendlyManager super-admin / **Clear Data**.
- **Xero Query** (`#xero-query`), **Audit Log** (`#log`).

⇒ Multi-tenant config: branding, terminology, module on/off, registration/embeds, payments, integrations, custom fields, audit. The **terminology + module-toggle + custom-fields** system implies FM is a **white-label, configurable multi-sport platform** (this tenant is Swimming; terminology/modules adapt per sport/club).

---

# REBUILD LIST — everything to rebuild

> The platform is a **white-label, multi-tenant, multi-sport club-management system**. The `fm-events` prototype currently implements an *enhanced* slice (Events + Bookings + Groups/Attendance + Forms + Access control). The rebuild = port every legacy module onto the `fm-events` (Nuxt + Supabase) foundation, with the enhanced events/booking engine as the centrepiece.

### A. Foundation / cross-cutting (build first)
1. **Multi-tenant org model** — real `organisations` with per-club branding (logo/header/backdrop/colours), domain (`{club}.friendlymanager.com`), currency/locale. *(fm-events has a stub org — needs real tenanting.)*
2. **Terminology engine** — per-tenant relabelling of core nouns (player/member/squad…).
3. **Module toggles** — enable/disable modules per club (awards, programmes, venues, assets, merchandise, resources).
4. **Roles & permissions** — No Login / Standard User / Roll Taker / Manager / Committee / Financial Admin / Club Admin + FM super-admin; **Switch Role**.
5. **Custom fields** — per-tenant person (and other entity) custom fields.
6. **Audit log** — entity change history (exists in fm-events schema; needs surfacing).
7. **Auth + public/embed surfaces** — member login, public registration, events-calendar embed, booking embed, public website signup forms.

### B. People (CRM)
8. Person directory (filters Members/Staff/Contacts/Other/New, configurable columns, saved presets, search/sort/paginate).
9. Rich person profile + tabs (Profile/Awards/Resources/Fees/Uniforms/Events/Attendance/Membership).
10. Reusable **contacts/guardians** (Primary/Standard/Emergency, related-comms), attach-existing, shared across members.
11. Tags, medical, photo-consent, newsletter subscription + **email bounce tracking**.
12. Per-person ledger, issued-assets, awards, squad-term history.
13. Reports: Membership Length, Duplicate Names, Medical, Gender presets.

### C. Squads / Groups + Terms (membership spine)
14. Squad CRUD (code-template, age/gender limits, capacity→waitlist, members-per-coach, public flag).
15. **Terms** (signup-open/close + priority pre-open windows) + **Codes** (squad templates across terms).
16. Waitlist, **Squad Allocation**, **Term Transfer** (bulk roll-over), Squad Announcement.
17. Reports: Members, Squads, Retention.

### D. Events ⭐ (the enhancement — use `fm-events` engine)
18. Event **calendar** (month/week/list) with **categories** (manage + colour + filter).
19. Replace legacy basic event with `fm-events` engine: multi-**sessions**, **registration forms** (FormBuilder), **ticket types**, **discounts**, **bookable-venue** linkage, invitee groups, RSVP/responses, **automation**, **reporting**, attendance.
20. Event visibility (Invitees / All members / Public), coordinator, notifications, fees + due dates.
21. Recurring training events ↔ squad class-times (already prototyped via member-group schedules).

### E. Venues & Bookings (use `fm-events` booking engine)
22. Venues + **sub-venues/lanes** + **Staff (private lessons)** as bookables (VENUE/PERSON + children).
23. Booking flows (scheduler/wizard/item), availability, modes, configurations, conflict/capacity.
24. **Access control** (doors/lights/codes) — already in fm-events, net-new vs legacy.

### F. Fees / Finance
25. Invoices (term-based + ad-hoc), credits, payments/transactions, statements.
26. Recurring fees, outstanding/overdue/missing reports.
27. **Xero integration** (config + query/sync) + payment methods.

### G. Attendance
28. Roll-taking per squad session, **Generate** from class-times, visitor logging, **Coach Hours** (payroll), non-attendance + attendance reports.

### H. Communications
29. Bulk **Mailer** (recipient selection by squad/custom/subscribers, attachments, reply-to), send **History**, newsletter subscription, bounce handling, **email templates**.

### I. Secondary modules (module-toggleable)
30. **Awards** (badge defs + groups + assign + report).
31. **Resources** (categorised document library + member visibility).
32. **Uniforms/Assets** (inventory + stock + merchandise sales + issue/return).
33. **Programmes** (holiday programmes: date-ranged bookable + signup window + discounts).
34. **Vouchers/Discounts** (codes).
35. **Sponsors**.

### J. Reporting & dashboard
36. Dashboard widgets (member breakdown, finance/outstanding trend, upcoming events, term-transfer prompt, email errors).
37. Cross-module reports (already enumerated per module).

---

## CRUD behaviour (exercised live — Squad, Event, Person; ZZTest data, cleaned up)

**Consistent interaction pattern across the whole app:**
- **Create:** dedicated `/{module}/new` form → on Save redirects to `/{module}/:id` (the new detail page).
- **Edit:** detail pages are **view-mode by default**; an **Edit** button toggles in-place edit mode (reveals `.edit-show` controls). Save is **AJAX/JS-driven** via a single **`#saveButton`** — the page does *not* reload, and the header text only refreshes on a manual reload (the edit *is* persisted).
- **Delete/Archive:** the destructive control is also `.edit-show` (only visible in edit mode, or under an **Actions** menu on People). Every destructive action pops a **Bootstrap confirm modal** (Cancel / Delete|Archive).
- **Delete semantics differ by entity type:**
  - **Squads → Archive only** (soft delete; `#archiveButton`). No hard delete.
  - **Events → hard Delete** (`#deleteButton`) → redirect to calendar.
  - **People → both** Archive *and* Delete Profile (under the **Actions** dropdown).
- **Custom date/time widgets (Events):** the date picker accepts typed input only when typed **slowly + Enter** to commit; the **time picker resists programmatic input** (reverts to 12:00 AM). Validation rule: **End must be after Start** — violating it **fails silently with no visible error** (the save button just does nothing). Ticking **All Day** removes the time requirement and lets it save. ⇒ rebuild should use proper native inputs + visible validation messages.
- **Person create** is plain (no widgets, saves first try); role defaults; creating a person *with a login role* feeds the **"Email New Logins"** queue (didn't trigger — used "No Login").
- **Squad detail** = members (Add Person) + **class-time schedule** rows (Day/Start/End/Venue) that feed **Generate Attendance**.
- **Event detail** = tabs **Details / Attendees / Customise Invitation**; actions **Send Invites**, **Take Attendance**, **View Report**; Attendees table = Name / **Status (RSVP)** / Note.

> Rebuild takeaways: (1) the legacy UX is a uniform "detail page + edit-toggle + AJAX save + confirm-modal delete" — `fm-events`' per-page editors already improve on this; (2) **inconsistent delete semantics** (archive vs delete vs both) should be unified; (3) **silent validation failures** (esp. date/time) are a real defect to fix in the rebuild; (4) the legacy event's Attendees/RSVP/Invitation model is the baseline the `fm-events` sessions/forms/tickets engine supersedes.

## Notes / gaps for next pass
- CRUD verified on Squad / Event / Person. **Not yet exercised:** the **Book** flow on `/venues` (the booking engine — highest-value remaining), a **Fee** create, **Registration** wizard end-to-end, **Mailer** send.

---

# PART 2 — LEGACY CODEBASE (`/old`) — the real architecture

> Source: the bespoke **PHP 8.1** app behind the live platform, uploaded to `/Users/karl/fm-events/old`. This is the authoritative source for the data model + business rules. Reveals a **much larger** system than the swimming demo's 12 visible modules — especially a full **Competitions** engine and a sophisticated **billing** engine.

## Architecture (legacy)
- **No framework** — custom MVC. Front controllers in `httpdocs/`: `index.php` (admin app), `app.php` (mobile JSON API), `api.php` (REST + bearer token), `public.php` (public JSON/HTML), `request.php` (AJAX `get/` + form `post/`, with **role-folder escalation**: `post/admin/x.php`, `post/manager/x.php`…), `embed.php` (iframe widgets, strict CSP), `webhooks/` (Xero, SparkPost, Kamar).
- **Routing:** URL → `pages/{module}/switch.php` sets the content template. ~35 modules.
- **Data layer:** custom active-record — `ClubDB` (PDO + multi-tenant factory + settings cache), `DBEntry` (base model, magic FK resolution `$fee->person()`, smart WHERE operators `amount>`, `status!`, `code%`), `DBTable` (repository: `find/get/create/count/select`). Every write is **audit-logged**.
- **Auth:** bcrypt, selector/validator auth tokens (passwordless + remember-me), **WebAuthn/2FA**, brute-force `LoginAttempts`. Roles (numeric): 0 none · 1 user · 2 basic · 3 manager · 4 coord · 5 fadmin · 6 admin · 7 experimental · 9 root.

## ⭐ Multi-tenancy model (major rebuild decision)
- **Database-per-club:** each tenant is its own MySQL DB `fm_<club>`; a central **`fm_system`** DB holds the Club registry (plan, status, subdomain `fmName`, timezone, Xero id…).
- **NSO federation:** a club can link to a National Sport Org — a shared `fm_<nso>` DB stores the **Person profile**, while club-local data stays in the club DB (`PersonClub`). Custom fields are NSO- vs club-scoped (`_`-prefixed). Hooks (`NSO\Hooks::updatedX()`) let the NSO react to club changes. NSO providers: GNZ, NZC, NZF, Sporty, allstar, fct, stj.
- ⇒ **fm-events uses a single Postgres DB scoped by `org_id`.** The rebuild must decide: keep DB-per-tenant (strong isolation, matches legacy + NSO model) vs single-DB-+-RLS (simpler, fm-events' current approach). This is the #1 architectural fork.

## Conventions (legacy schema)
PascalCase tables (`Person`, `Group`, `TermFee`), camelCase columns (`firstName`), `id` int PK, **`status` tinyint = soft-delete + state** (−2 archived, −1 new, 0 deleted, 1 default, 2 restricted), `guid` for external sync, **polymorphic FKs** (`Fee.assocType`+`assocID` → Group/Event/Comp/CompTeam), JSON-in-text (`teamFields`, `memberGroups`), composite PKs on junctions.

## Full entity model by domain (~52 core tables + ~30 competition tables)
- **People:** `Person` (role, status, contacts via `primaryContactID`, `invalidEmail` bounce state, `concessions`, `xeroID`, `ezidebitCustomerID`), `PersonGroup` (**the membership spine**: personID×groupID×**termID**, `staff` 0=member/1=staff/−1=**waitlist**, position), `PersonTag`, `CustomField`/`CustomSelectValue`/`CustomFieldPerson`, `VaccinePass`, `PoliceVet`, `LoginAttempts`.
- **Groups/Terms:** `Group` (codeID, headID coach, limit→waitlist, age/gender, playersPerStaff, public), `GroupTime` (weekly schedule day/start/end/location), `Code` (hierarchical squad template + affiliation config, `termset`), `Term` (start/end + `signupOpenDate`/`signupCloseDate`/`preOpenDate` + `transferable` + `termset` A–F), `TransferRequest`.
- **Fees/billing:** `TermFee` (per term×group fee template: types STANDARD / PRORATA_W / PRORATA_M / MONTHLY / CLASS / CONCESSION / JOIN / AFFILIATION; dueDays; line items via `TermFeeItem`), `Fee` (invoice/credit note/overpayment/prepayment/multi; `assocType/assocID`; `parentFeeID`; `promptDiscount`; `xeroID`; `account`), `Transaction` (methods CASH/EFTPOS/CC/BANK/CHEQUE/DD/DEDUCT/ALLOC/OVERPAY/PREPAY; statuses scheduled/pending/failed/dishonoured), `Voucher`, `Discount` (multi-buy/family tiers).
- **Events/attendance:** `Event` (types ATTENDANCE/BOOKING/GAME/ONLINE/PROGRAM; visibility default/global/public; venueID; fee+feeDue; awardID; programID; `terms`; notifications), `EventGroup` (invited squads), `EventPerson` (RSVP/attendance: unknown/withdrawn/confirmed/waiting; guests as negative id), `EventCategory`, `Ticket`.
- **Venues/bookings:** `Venue` (parentID = sub-venues/lanes; **personID = staff/private-lesson bookable**; maxBookings; min/maxDays notice; memberGroups restriction; account), `VenueTime` (slots: day/start/end + `bookType` NEVER/REGISTERED/MEMBERS/PUBLIC), `VenueSport`. Bookings are stored as `Event` rows (TYPE_BOOKING) — conflict checked at venue level incl. parent/child.
- **Competitions (huge — invisible in swim demo):** `Comp`, `CompSport` (+~30 sport variants w/ scoring rules), `CompDivision`, `CompTeam`/`CompTeamPerson`/`CompTeamPlace`/`CompTeamConflict`/`CompTeamExclusion`, `CompRound`/`CompPool`/`CompGroup`, `CompGame`/`CompGamePerson`/`CompGameOfficial`/`CompGamePoints`/`CompGameStats`, individual-comp side: `CompSession`/`CompSessionParticipant`/`CompEvent`/`CompSessionSchedule`/`CompSessionScore`/`CompSessionOfficial`, `CompCertificate`, `CompDuty`, `CompClubRole`. Token-based public RSVP/score entry/judging.
- **Signup forms:** `RegForm` (types default/family/team/club/program/shop; signup-term binding; billingCodeID; vaccine/concession options; custom terms/success text), `RegTab`, `RegFormCode`.
- **Awards:** `Award`/`AwardGroup` (SEQUENTIAL vs PARALLEL progression, auto-complete)/`AwardPerson`/`AwardSequence`.
- **Assets/uniforms:** `Asset` (merchandise flag, customise, purchaseType bitmask rent/purchase, group-restrict), `AssetOption` (size/colour variant pricing), `AssetPerson` (issue/return per term).
- **Resources:** `Resource`/`ResourceCategory`/`ResourceCategoryGroup`/`ResourceCategoryLink`/`ResourcePerson`.
- **Comms/config:** `Email`, `Sponsor`, `Settings`/`Settings2` (key-value club config inc. module toggles, terminology, currency, membership-model), `Log` (audit), `Program`.

## Business rules worth preserving (from `application/classes/`)
- **Pro-rata billing** (PRORATA_W/M reduce by weeks/months elapsed since term start); **prompt discount** (early-payment % held "unconfirmed" — negated if paid by due date, added back if late); **TYPE_CLASS** fee = base × attendance count; **affiliation fees** auto-applied annually on group join (fiscal vs calendar `affiliationYear`); **subscriptions** (monthly/3/6/12-month renewal day-of-month).
- **Payments:** Ezidebit direct debit (schedule ≥30 days out, max 2/date, date-spreading; dishonour soft/fatal retry), Stripe, Windcave; **credit notes/overpayments auto-allocated** to outstanding fees (DEDUCT loose vs ALLOC tied); **Xero** OAuth2 sync (Fee→Invoice/CreditNote, Transaction→Payment, idempotent via `xeroID`, `XeroError` log, optional tracking codes).
- **Membership:** **waitlist** = `PersonGroup.staff=-1`, promoted by position on a member leaving; **term transfer** (bulk roll-over, affiliation-year checks); age/gender enforced at signup.
- **Bookings:** `Venue.availableTimes()` honours min/max-days notice, term vs non-term, weekday/weekend, max-concurrent, per-staff repeat limits.
- **Awards:** sequential = one in progress, completing auto-starts next.

## Integrations (legacy) — rebuild must account for
Xero (accounting), Stripe + Windcave + Ezidebit (payments/direct-debit), SparkPost (email), HubSpot, Kamar (school SMS sync), mPDF (invoices/certs/reports), libvips (images), WebAuthn/JWT (2FA), QR decode (attendance/vaccine), NSO provider APIs (GNZ/NZC/NZF/Sporty). **Crons:** recurring fees, prompt-discount reversal, subscription expiry, statements, Xero sync, Ezidebit sync, signup reminders, stats, NSO imports. **Mobile API** (`/app/*`): attendance scan, live game feed, score submission. **Embeds:** calendar, register, book, programs, competitions, waiver.

---

# REVISED REBUILD SCOPE (incorporating `/old`)

The earlier 37-item list (Part 1) stands but **understated** the system. Material additions/corrections:

- **NEW top decision — tenancy:** DB-per-club + NSO federation (legacy) vs single-DB + `org_id`/RLS (fm-events). Must resolve before building foundation. NSO federation (shared profile across national body + clubs) is a real, load-bearing feature, not optional.
- **NEW major module — Competitions:** draws/divisions/pools/rounds/games/officials/per-sport scoring/individual sessions + public score-entry & judging. ~30+ tables. Entirely absent from fm-events today. Likely the single biggest net-new build.
- **Billing is a real engine, not "fees":** pro-rata, prompt discounts, subscriptions, affiliation fees, multi-buy/family discounts, direct-debit (Ezidebit) + Stripe + Windcave, credit-note auto-allocation, Xero two-way sync, recurring-fee + statement crons. fm-events' current fee model is far simpler — this is a large workstream.
- **NEW modules/features:** Waivers (digital signing), Vaccine pass / Police vetting (compliance), Mobile app API, public **embeds** (calendar/register/book), webhooks, HubSpot/Kamar/NSO-provider syncs, audit log, custom-field engine (already noted), terminology + module-toggles (already noted).
- **Registration is deeper than forms:** `RegForm` types (default/family/team/club/program/shop) drive signup that creates Person + PersonGroup(term) + Fee + payment in one flow — tightly coupled to Terms/Squads/Billing.
- **Roles** are a 9-level hierarchy with **per-handler folder enforcement** — richer than fm-events' current gate.

**Net:** fm-events today ≈ the enhanced **Events + Bookings + Groups/Attendance + Forms + Access** slice. The full rebuild must additionally deliver: **Competitions**, a real **Billing/payments/Xero** engine, **multi-tenant + NSO** foundation, **Registration** wizard tied to terms/fees, **Compliance** (waivers/vaccine/vetting), **Mobile API**, **Embeds**, and the **integration/cron** layer.
- Not yet opened in depth: `/help`, individual Settings sub-tabs (Financial/Emails/Integrations field-level), the public **/register** wizard steps, the **Book** flow on `/venues`, event **detail/RSVP** page, Holiday Programme detail.
- Confirm which legacy modules are **in vs out** of scope for the rebuild (e.g. is Uniforms/merchandise in v1?).

