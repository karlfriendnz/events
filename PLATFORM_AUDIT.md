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


---

# PART 3 — NEW BUILD vs LEGACY: STATUS (updated 7 Jul 2026)

> Where the rebuild actually stands against the 37-item list and the legacy behaviours.
> Legend: ☑ built (parity or better) · ◐ partial · ☐ not started · ⭐ exceeds legacy

## A. Foundation
| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Multi-tenant org model | ◐ | Org hierarchy + levels (CLUB→NATIONAL+RST), super-admin console `/admin`, branding (logo/icon/brand colours/banner), currency/locale, season. **Tenancy fork resolved de facto: single Postgres + `org_id`** (RLS hardening still outstanding — only `org_members` has RLS). NSO federation modelled via `org_ancestors` + per-sport affiliation (`org_sports`), not shared-DB. |
| 2 | Terminology engine | ⭐ | `organisations.terminology` (145) + **sport-scoped sets** (`org_sports.terminology`, 233 — beyond legacy's single per-club set), NSO inheritance, `code` key added. `useTerms()` consumption layer + **app-wide sweep done** (groups/people/events/dashboard/detail/settings — ~250 strings). Legacy parity reached and exceeded; remaining hardcodes: nav labels (layout), "Classes" breadcrumbs decision. |
| 3 | Module toggles | ☑ | `organisations.enabled_modules` (226) + `/settings/modules`, live nav filtering. |
| 4 | Roles & permissions | ◐ | Core templates (154) + club override, permission grid, People/Entities/Access model in `useCan`, **scoped per-resource roles** (183/184 — beyond legacy), **route read-gates + `<Can>` component (new)**. Missing: per-button `<Can>` sweep, nav hiding, Switch Role. |
| 5 | Custom fields | ⭐ | Full field engine: `field_definitions` multi-target, person/entity types, NSO inheritance + locking, per-type form layouts (`<PersonFormBuilder>`), core-fields policy. Far beyond legacy's flat custom fields. |
| 6 | Audit log | ☐ | Not surfaced (legacy audit-logs every write). |
| 7 | Auth + public/embeds | ◐ | Public registration `/r/:context/:id` (event/group/form), public booker `/book`, OTP/password/QR auth chooser. Embeds for calendar/site not built. |

## B. People
| 8–13 | Directory, profile, contacts, ledger, reports | ◐ | Directory w/ type tabs + per-tab columns + bulk actions; rich profile (configurable **profile dashboard** ⭐, designed layouts, notes w/ channels); **contacts & circles** (families, act-on-behalf ⭐); retention report. Missing: bounce tracking, membership-length/duplicates reports, per-person financial ledger (blocked on billing engine). |

## C. Squads/Groups + Terms — **the spine: essentially rebuilt, mostly beyond legacy**
| # | Item | Status | Notes |
|---|---|---|---|
| 14 | Squad CRUD | ☑ | Groups w/ codes, age/gender restriction, capacity, image, sub-groups, positions/role minimums (⭐). |
| 15 | Terms + Codes | ⭐ | `org_terms` w/ **sign-up windows** (230), **term sets** (232) **connected to sports** (235), hierarchical codes (205) w/ per-code member types/roles/staff/positions. Legacy `termset` A–F letters → real named sets. |
| 16 | Waitlist / Allocation / Term Transfer | ⭐ | Waitlists as shared queues across equivalent classes (221–223, richer than legacy staff=-1), allocator board, **rollover engine + 7-step Term set-up wizard** (nudge banner = legacy transfer banner parity; per-person staff carry, fees editing w/ change tracking, discontinued classes 231, training-event generation). Squad Announcement: not built (email stub). |
| 17 | Reports | ◐ | Retention ☑, Week View/Class Finder ⭐; Members/Squads reports partially via Classes board + saved views. |
| — | **Legacy term edit/delete rules** | ☐ | Audited 7 Jul: legacy allowed editing any term any time EXCEPT date-overlap-within-set (hard server check); delete blocked (UI-only) when term had non-staff members, else cascade fees+memberships then soft-delete. **New build lacks the overlap check and the member-guard/cascade on delete** — adopt both (server-side), keep our stricter registrations-lock on dates. |

## D–E. Events + Venues/Bookings | ⭐ | The enhanced engine is the build's centrepiece and exceeds legacy throughout (sessions/forms/tickets/discounts/automation/reporting; bookables/modes/configurations/3 booking flows/access control). Event categories + calendar ☑. |

## F. Fees / Finance
| 25–27 | Invoicing engine | ◐ | Group fee options w/ line items + due/deposit (204/225), free classes allowed, **Xero foundation** (228: OAuth, account mapping, tracking categories, `<XeroAccountInput>` platform-wide). **Missing: the actual billing engine** — invoices/payments/credits/pro-rata/prompt discounts/subscriptions/direct-debit/statements/Xero sync. Still the biggest F-workstream. |

## G–J. Attendance / Comms / Secondary / Dashboard
| 28 | Attendance | ◐ | Training events auto-generated w/ pre-rostered invitees, attendance tab + landing + group matrix report/export. Missing: coach hours, visitors. |
| 29 | Mailer | ☐ | Not built (biggest H gap; announcement email stubbed "coming soon"). |
| 30–35 | Awards/Resources/Uniforms/Programmes/Vouchers/Sponsors | ☐ | Nav stubs only. Booking discounts exist (booking engine); form-level financial rules exist. |
| 36–37 | Dashboard + reports | ☑ | Per-user/per-role configurable widget dashboard ⭐, chart widgets, rollover nudge, finance/event reporting pages. |

## Net-new vs legacy (no legacy equivalent)
**Help documentation system** (234: explanation + step tutorials, terminology tokens, module+permission-gated visibility, chatbot-ready, `/admin/help` + `/help`) · access control (doors/lights/codes) · review/sign-off widget · profile dashboards · Week View + Class Finder · multi-subject registration forms (people + entities) · entity records · org-buildable roles/capabilities.

## Biggest remaining gaps (ranked)
1. **Billing/payments engine** (F) — invoices, payments, credits, recurring, direct debit, Xero sync (foundation ready).
2. **Competitions** (Part 2) — untouched, largest net-new module.
3. **Mailer/comms** (H) — nothing yet; several flows stub into it.
4. **RLS/tenant hardening + audit log** (A) — before production.
5. **Compliance/mobile/embeds** (waivers, vetting, app API, site embeds).
6. Term lifecycle guards (overlap check, member-guarded delete) — small, adopt from legacy.

## Everything the NEW BUILD adds that legacy never had (full list, 7 Jul 2026)

**Booking engine:** three booking flows (wizard / single-screen scheduler / item-rental rate cards) · activity modes w/ per-bookable pricing overrides · venue configurations w/ atomic multi-slot booking (halves/quarters) · equipment bundling + capacity · booking discounts engine · coach ("what I offer") + item + sport + club-setup wizards · **physical access control** (doors, light zones, access codes, unlock windows) · act-on-behalf booking subjects.

**Events:** multi-session events · **multi-subject registration forms** (people AND entities: Team/Company/School, per-subject fields/min/max, presets, step wizard) · form designer w/ banner/icons/sponsors · tickets · automation · per-session reporting · staff register-on-behalf · public reg links + QR.

**Registration engine:** public `/r/:context/:id` pages (event/group/form) · forms connected to whole programmes (dynamic class lists w/ live spaces) · waitlist-aware submission (full class → queue, offers siblings w/ space) · answers materialised onto person profiles by field id.

**Classes/Terms spine:** Week View timetable (density-adaptive, day view) · **Class Finder** · saved class views · Classes board · hierarchical codes w/ per-code member types, staff roles, role/position minimums, code-level staff · **7-step Term set-up wizard** (programmes & management review w/ vacancy search, per-person staff carry, per-programme fee confirmation w/ change-tracking + reset, training-event generation) · **term sets connected to sports** · sign-up windows on terms · discontinued-class lifecycle · free classes · group images w/ crop · sub-group drag boards · retention report.

**People:** club-configurable **profile dashboards** (drag/drop widgets, per-role defaults) · designed per-type profile layouts · **contacts & circles** (families, split families, act-on-behalf, per-relationship comms categories) · person notes w/ channels + context links · entity records w/ rosters · multi-role people.

**Platform:** **sport-scoped terminology** (per-sport vocabularies, NSO inheritance, app-wide) · **help documentation system** (terminology tokens, module+permission-gated, chatbot-ready) · review/sign-off widget (pinned comments, reviewer matrix) · permission-grid route gates + `<Can>` · org hierarchy w/ disciplines, brands, master catalogues, super-admin console · per-role dashboard templates · club module toggles UI · Xero foundation w/ platform-wide account picker + tracking categories · brand CSS theming · mobile-first design system.

## Per-page / per-function breakdown (7 Jul 2026)

### Dashboard — 72%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Members breakdown widget | ★ EXCEEDS | /dashboard stat tiles + custom chart widgets (any field, pie/bar); Configurable per-user grid + per-role default templates | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Finance / outstanding widget | BUILT | Outstanding money dashboard tile: unpaid registrations total + count, links to Finances | Fee due-date breakdown once the invoice ledger lands | ☐ | ☐ | ☐ | ☐ | ☐ |
| Upcoming events widget | BUILT | /dashboard upcoming events card | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Term-transfer banner | ★ EXCEEDS | Rollover nudge banner — lineage-aware, per-sequence, terminology-driven; 3-day snooze; links into the term wizard | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Email-error banner | NOT STARTED | — | Bounce tracking on the send pipeline (arrives with Mailer) | ☐ | ☐ | ☐ | ☐ | ☐ |

### People — 46%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Directory | BUILT | /people with person-type tabs + per-tab column sets (incl. custom fields); Search, bulk set-type/delete, CSV-friendly columns | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| New person | BUILT | Add-person dialog on /people and inside groups (incl. inline new-person) | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Person profile | ★ EXCEEDS | Live-form profile with designed per-type layouts (WYSIWYG builder); Club-configurable profile dashboard w/ notes + activity; Multi-role people; photo avatar | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Contacts / guardians | ★ EXCEEDS | Contacts & Circles: families incl. split families; Act-on-behalf booking/registration; Per-relationship comms categories; primary/emergency types | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Entity records (Team/Business/School/Family) | NEW | /organisations directory + entity records with people rosters; Entity types with their own fields + member slots | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Person notes with channels | NEW | Notes on any person, scoped to context (group/waitlist/term); Interaction channel (in person/phone/email/SMS), hover preview | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Profile: Fees tab (ledger) | NOT STARTED | — | Per-person ledger: invoices, payments, credits, refunds; Blocked on the billing engine | ☐ | ☐ | ☐ | ☐ | ☐ |
| Profile: Awards / Resources / Uniforms tabs | NOT STARTED | — | Build those modules, then surface their profile tabs | ☐ | ☐ | ☐ | ☐ | ☐ |
| Profile: Membership history | PARTIAL | Membership tab: current groups + per-group role editing | Full class x term history view (data already on memberships via term_id) | ☐ | ☐ | ☐ | ☐ | ☐ |
| People reports | NOT STARTED | — | Membership-length report; Duplicate-name detection | ☐ | ☐ | ☐ | ☐ | ☐ |
| Logins / archive / restrict | NOT STARTED | — | Login-invitation queue (Email New Logins); Archive + restrict-registrations states | ☐ | ☐ | ☐ | ☐ | ☐ |

### Squads / Classes — 78%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Locations (multi-site clubs) | NEW | Locations entity + staff access grants (location x sport, null = all); Global location lens (header switcher) filtering classes/people/attendance/week view/fees/waitlists/allocator/dashboard; Class staff get site access automatically via class assignments; Detail pages kick out like a permission miss when out-of-lens; Term sequences + memberships scopable to one or more locations | Sport-gating on remaining lens screens; Events/bookings lens; Verify with a real staff login | ☐ | ☐ | ☐ | ☐ | ☐ |
| Drag ordering everywhere | NEW | Classes + memberships boards: drag to reorder (edge bands), drop on programme/tab to move into it; Middle-band drop nests (join umbrella / create-programme dialog) | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Groups landing | ★ EXCEEDS | Classes board: programme tabs, term filter, live columns (fill, fees, signup); Saved views + views manager; week-view links per programme | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Week View timetable | NEW | Time x weekday grid of every class, density-adaptive summaries, day view; Colour-coded by programme, capacity chips, click-through modals | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Class Finder | NEW | Find-a-class drawer from any screen: age/day/time/programme/space matching; Ranked results with add-person deep links | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| New squad | BUILT | New group dialog + full group editor (age, gender restriction, capacity, image w/ crop) | Enforce members-per-coach ratio (legacy playersPerStaff) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Terms admin | ★ EXCEEDS | /settings/memberships: terms w/ sign-up open/close windows; Term sets (independent sequences) connected to sports | Date-overlap check within a set (legacy's one hard rule); Member-guarded delete + fee/membership cascade, enforced server-side | ☐ | ☐ | ☐ | ☐ | ☐ |
| Codes | ★ EXCEEDS | Drag hierarchy manager + per-code settings; Member types, staff roles w/ lineage, role/position minimums, code-level staff | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Waitlist | ★ EXCEEDS | Shared queues across equivalent classes; Ordering modes (custom/FIFO/priority), enrol-from-waitlist, term rollover, CSV | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Squad Allocation | BUILT | Drag allocation board w/ capacity colouring, duplicates highlight, mobile fallback | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Term Transfer | ★ EXCEEDS | Batch rollover screen + 7-step Term set-up wizard; Programme management review w/ vacancy search; per-person staff carry; Per-programme fee confirmation w/ change tracking + reset; training-event generation; discontinued classes | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Squad detail | ★ EXCEEDS | Group page: hero, session times, fees, sub-group boards, positions, attendance matrix; Public registration page + QR; waitlist-aware add-person | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Squad Announcement | NOT STARTED | — | Message-a-class email (needs Mailer; wizard already stubs it) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Members / Squads reports | PARTIAL | Classes board columns + saved views + people-tab exports; Classes Reports page: classes/week, hours, spots filled, utilisation — overall + by location + by programme | Dedicated members/squads report views | ☐ | ☐ | ☐ | ☐ | ☐ |
| Retention Report | BUILT | /groups/retention: A-to-B term comparison, segments, CSV, copy-emails | — | ☐ | ☐ | ☐ | ☐ | ☐ |

### Events — 90%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Calendar + categories | BUILT | /events list + calendar toggle, search, filters | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| New event | ★ EXCEEDS | Basic wizard w/ public form toggle, advanced wizard, bulk multi-create | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Event detail | ★ EXCEEDS | Sessions, multi-subject forms, tickets, discounts, automation, reporting, attendance check-in; Staff register-on-behalf + public links | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Multi-subject / entity registration | NEW | Forms register people AND entities (Team/Company/School) with per-subject fields, counts, presets; Step-wizard form style; per-subject session choice | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Training <-> class times | BUILT | One-click training-event series from weekly schedules, rosters pre-invited | — | ☐ | ☐ | ☐ | ☐ | ☐ |

### Venues & Bookings — 90%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Venues + lanes | ★ EXCEEDS | Bookables tree w/ configurations (halves/quarters), modes, items, images | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Access control | NEW | Doors, light zones, access codes, unlock windows, per-booking schedules | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Staff (private lessons) | ★ EXCEEDS | Coach bookables w/ what-I-offer editor + coach wizard | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Book flow | ★ EXCEEDS | 3 flows: wizard, single-screen scheduler, item rental; Public /book w/ auth chooser (guest/OTP/password/app) + act-on-behalf | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Guided setup wizards | NEW | Sport, coach, item, and whole-club setup wizards seeding venues/activities/modes end-to-end | — | ☐ | ☐ | ☐ | ☐ | ☐ |

### Registration (public) — 25%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Register wizard | PARTIAL | Public /r pages for events, classes, programme-connected forms; Multi-subject forms, fee-option choice, live class spaces; Waitlist-aware submission; answers materialise onto profiles | Payment processing at submit; Customer confirmation email; Re-register / EOI flows; Hold-space pending memberships | ☐ | ☐ | ☐ | ☐ | ☐ |
| Merchandise (shop form) | NOT STARTED | — | Shop form type — needs Uniforms/merch + billing | ☐ | ☐ | ☐ | ☐ | ☐ |

### Class fees & Xero — 70%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Term Fees | ★ EXCEEDS | Group fee options w/ line items + Xero codes, 5 fee types, due date + deposit; Bulk add-to-many-classes; free classes fully supported | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Xero | PARTIAL | OAuth connect w/ tenant safety, bank/tax/account mapping, tracking categories; Platform-wide account picker (XeroAccountInput) | Invoice/payment two-way sync once the ledger exists (plumbing ready) | ☐ | ☐ | ☐ | ☐ | ☐ |

### Payments & invoicing — 12%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Invoices / Add Fee / Add Credit | NOT STARTED | — | The billing engine: invoice + credit-note model; Payments w/ methods; credit auto-allocation; Pro-rata, prompt discounts, recurring, direct debit (Ezidebit), Stripe/Windcave | ☐ | ☐ | ☐ | ☐ | ☐ |
| Transactions | PARTIAL | /finances reporting view | Real transaction ledger once the engine lands | ☐ | ☐ | ☐ | ☐ | ☐ |
| Money reports | NOT STARTED | — | Outstanding / Overdue / Missing / Recurring reports off the ledger | ☐ | ☐ | ☐ | ☐ | ☐ |
| Email Statements | NOT STARTED | — | Statement generation + send (needs ledger + Mailer) | ☐ | ☐ | ☐ | ☐ | ☐ |

### Attendance — 46%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Landing + take attendance | BUILT | /attendance 15-day view + per-event attendance tab | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Generate from class-times | BUILT | Training-event generation from group page + term wizard (idempotent) | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Attendance reports | PARTIAL | Per-group people x session matrix w/ filter + CSV export | Club-wide attendance + non-attendance reports | ☐ | ☐ | ☐ | ☐ | ☐ |
| Coach Hours | NOT STARTED | — | Staff hours from sessions (payroll export) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Visitors | NOT STARTED | — | Visitor / drop-in logging | ☐ | ☐ | ☐ | ☐ | ☐ |

### Mailer — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Bulk composer | NOT STARTED | — | 3-step composer: recipients by class/custom/subscribers; Attachments, reply-to, CC myself | ☐ | ☐ | ☐ | ☐ | ☐ |
| History | NOT STARTED | — | Send history + delivery status | ☐ | ☐ | ☐ | ☐ | ☐ |
| Templates | NOT STARTED | — | Club email templates in Settings | ☐ | ☐ | ☐ | ☐ | ☐ |

### Awards — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Awards module | NOT STARTED | — | Badge definitions + groups, sequential progression, assign, report, profile tab | ☐ | ☐ | ☐ | ☐ | ☐ |

### Resources — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Resources module | NOT STARTED | — | Categorised document library w/ member visibility | ☐ | ☐ | ☐ | ☐ | ☐ |

### Uniforms & Merchandise — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Uniforms / merchandise module | NOT STARTED | — | Inventory + variants + stock; Merch sales via shop form; issue/return per term | ☐ | ☐ | ☐ | ☐ | ☐ |

### Holiday Programmes — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Programmes module | NOT STARTED | — | Date-ranged bookable programmes w/ own windows + discounts | ☐ | ☐ | ☐ | ☐ | ☐ |

### Vouchers & Sponsors — 50%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Vouchers | PARTIAL | Booking discount rules engine; event discount codes | Club-wide voucher codes redeemable at registration | ☐ | ☐ | ☐ | ☐ | ☐ |
| Sponsors | PARTIAL | Sponsor strip in the form designer | Club-level sponsor catalogue in Settings | ☐ | ☐ | ☐ | ☐ | ☐ |

### Competitions — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Full competitions engine | NOT STARTED | — | Divisions, pools, rounds, games, officials; Per-sport scoring + individual sessions/judging; Public score entry — largest net-new build (~30 legacy tables) | ☐ | ☐ | ☐ | ☐ | ☐ |

### Onboarding — 22%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Club setup wizard (venues & areas) | BUILT | Conversational whole-club setup: areas, counts, booking modes, availability, photo (/bookables/new-v2); Sport / coach / item wizards | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Full club onboarding journey | NOT STARTED | — | Guided first-run: club details, branding, sports, terms, programmes & classes, fees, invite staff; Progress checklist on the dashboard until complete | ☐ | ☐ | ☐ | ☐ | ☐ |
| Member onboarding | NOT STARTED | — | Welcome email + login setup after registration; Email New Logins queue (legacy parity) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Data import | NOT STARTED | — | CSV / legacy-FM import: people, contacts, classes, terms, fee history | ☐ | ☐ | ☐ | ☐ | ☐ |

### Member portal (self-service) — 28%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Memberships engine | NEW | Membership = group without a timetable (kind discriminator; roster/fees/waitlist/restrictions/staff for free); Entitlements: included / % off / $ off per class, programme (dynamic) or event; Programme umbrellas (tiers) + everyone-across-tiers report; Hello Club-parity settings captured: renewal, auto-renewal, anchoring, purchasable-by, payment collection, approval, account credit; Coverage in staff enrol flow (Included in their Senior Membership); Own URLs/breadcrumbs (/memberships), location scoping, lens-aware creation | Renewal/collection/credit engines (settings captured, not enforced); Member-side purchase + tier-choice registration flow; Public-form coverage + discounted-price math | ☐ | ☐ | ☐ | ☐ | ☐ |
| My contacts & circles | BUILT | /account/profiles: manage own contacts/circles, edit dependants' profiles (Profiles I manage) | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| My profile self-service | PARTIAL | Profile editing exists for staff-side; act-on-behalf model in place | Member-facing my-profile page (own details, comms preferences) | ☐ | ☐ | ☐ | ☐ | ☐ |
| My classes & registrations | NOT STARTED | — | Member view of enrolled classes, upcoming sessions, registration history | ☐ | ☐ | ☐ | ☐ | ☐ |
| My bookings | NOT STARTED | — | Member view + manage of their venue/coach bookings | ☐ | ☐ | ☐ | ☐ | ☐ |
| My invoices & payments | NOT STARTED | — | Member ledger view + pay online (needs billing engine) | ☐ | ☐ | ☐ | ☐ | ☐ |

### National & regional — 66%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Org hierarchy | BUILT | Club - Regional - Association - National (+ RST) with recursive ancestors/descendants; Super-admin console + level-filtered org table | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Disciplines | BUILT | NSO-owned hierarchical disciplines; clubs map groups/events to them (multi-NSO) | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Per-section affiliation | PARTIAL | org_sports: each sport connects to its own governing body; primary mirrors parent_id | Resolve field/rule inheritance via the GROUP's affiliation chain (not just the club's primary) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Inherited fields & types | ★ EXCEEDS | NSO fields flow down with locking; person types; core permission templates | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Inherited terminology | ★ EXCEEDS | NSO terminology inheritance + per-sport overlays | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Cross-club people & roll-up reporting | PARTIAL | person_memberships (cross-club, multi-sport, reportable via org_ancestors); demo seeded | Regional/association/national reporting dashboards; NSO views of member data across clubs | ☐ | ☐ | ☐ | ☐ | ☐ |
| NSO provider syncs | NOT STARTED | — | GNZ / NZC / NZF / Sporty provider integrations (legacy parity) | ☐ | ☐ | ☐ | ☐ | ☐ |

### Help & support — 46%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Help articles | ★ EXCEEDS | Structured articles: explanation + step-by-step tutorial, terminology tokens per club; /admin/help authoring (module + permission + route + draft/publish) | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Gated club-side help | BUILT | /help shows an article only when its module is ON and the user's role can access the feature | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Article coverage | PARTIAL | 4 seed articles (term wizard, classes, fees, waitlists) | Author articles for every module as features land | ☐ | ☐ | ☐ | ☐ | ☐ |
| Contextual in-app help | NOT STARTED | — | ? icon per page opening the matching article; Nav entry for /help (layout file) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Help chatbot | NOT STARTED | — | Chat over the structured articles (the token/steps format is designed for this) | ☐ | ☐ | ☐ | ☐ | ☐ |

### Zoho integration — 0%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Zoho Desk (support) | NOT STARTED | — | Raise a support ticket from /help; Sync club/person context onto tickets | ☐ | ☐ | ☐ | ☐ | ☐ |
| Zoho CRM | NOT STARTED | — | Contact/org sync (scope to be defined with FM) | ☐ | ☐ | ☐ | ☐ | ☐ |

### Settings & platform — 58%

| Feature | Status | What's been done | What needs to be done | Karl | Kate | Rodd | FM | HC |
|---|---|---|---|---|---|---|---|---|
| Deployment smoke tests | NEW | 42-check read-only Playwright suite (npm run test:smoke): every core route — 500s, page errors, failing API calls, login bounces; Runs against any TEST_BASE_URL post-deploy; degrades to public subset without creds; Already caught + fixed two silent query bugs (finances, reporting) | Wire into the deploy pipeline | ☐ | ☐ | ☐ | ☐ | ☐ |
| Dashboard insight widgets | NEW | 12 opt-in widgets: registrations/week, sign-up gaps, outstanding money, utilisation, waitlists (enrollable today), locations, season pulse, attendance, staff coverage, memberships, retention, birthdays; Content block (rich text, background, image, buttons) for member dashboards; Self-loading widget architecture: any feature ships a dashboard card with one file | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Club info / branding | BUILT | Name, logo, icon, brand colours w/ preview, dashboard banner, currency/locale, season | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Module toggles | BUILT | /settings/modules per-club switches w/ live nav filtering | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Terminology | ★ EXCEEDS | Club renaming w/ NSO inheritance + sport-scoped vocabularies (per-sport sets); Wired app-wide (~250 strings: groups, people, events, dashboard, settings) | Nav labels (layout file); Hardcoded Classes-breadcrumb decision | ☐ | ☐ | ☐ | ☐ | ☐ |
| Custom fields | ★ EXCEEDS | Types & fields engine: multi-target defs, person/entity types, NSO locks, designed layouts, core-fields policy | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Registration forms & embeds | PARTIAL | Forms library + designer + connections to programmes; public form pages | Public site embeds: calendar, register, book widgets | ☐ | ☐ | ☐ | ☐ | ☐ |
| Financial settings | PARTIAL | Payment options editor (methods + defaults) | Stripe / Ezidebit / Windcave provider config once billing lands | ☐ | ☐ | ☐ | ☐ | ☐ |
| Email templates | NOT STARTED | — | Template editor (with Mailer) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Integrations | PARTIAL | Xero foundation | Stripe, Ezidebit, SparkPost, HubSpot, Kamar, NSO provider syncs | ☐ | ☐ | ☐ | ☐ | ☐ |
| Permission enforcement | PARTIAL | Permission grid + core templates + scoped per-resource roles; Route read-gates middleware + Can component | Per-button Can sweep across pages; Nav hiding by permission; Switch Role | ☐ | ☐ | ☐ | ☐ | ☐ |
| Tenant security (RLS) | PARTIAL | org_id scoping app-wide; org_members has RLS | RLS policies across ~87 tables before production | ☐ | ☐ | ☐ | ☐ | ☐ |
| FM super-admin | BUILT | /admin console, master catalogues (brands/club types/sports), core permission templates | — | ☐ | ☐ | ☐ | ☐ | ☐ |
| Audit log | NOT STARTED | — | Surface change history (legacy audit-logged every write) | ☐ | ☐ | ☐ | ☐ | ☐ |
| Review & sign-off system | NEW | In-app page review: pinned comments, reviewer sign-offs, cross-page report matrix | — | ☐ | ☐ | ☐ | ☐ | ☐ |

## Still to do — the full list

**Dashboard**
- **Finance / outstanding widget** — Fee due-date breakdown once the invoice ledger lands
- **Email-error banner** — Bounce tracking on the send pipeline (arrives with Mailer)

**People**
- **Profile: Fees tab (ledger)** — Per-person ledger: invoices, payments, credits, refunds
- **Profile: Fees tab (ledger)** — Blocked on the billing engine
- **Profile: Awards / Resources / Uniforms tabs** — Build those modules, then surface their profile tabs
- **Profile: Membership history** — Full class x term history view (data already on memberships via term_id)
- **People reports** — Membership-length report
- **People reports** — Duplicate-name detection
- **Logins / archive / restrict** — Login-invitation queue (Email New Logins)
- **Logins / archive / restrict** — Archive + restrict-registrations states

**Squads / Classes**
- **Locations (multi-site clubs)** — Sport-gating on remaining lens screens
- **Locations (multi-site clubs)** — Events/bookings lens
- **Locations (multi-site clubs)** — Verify with a real staff login
- **New squad** — Enforce members-per-coach ratio (legacy playersPerStaff)
- **Terms admin** — Date-overlap check within a set (legacy's one hard rule)
- **Terms admin** — Member-guarded delete + fee/membership cascade, enforced server-side
- **Squad Announcement** — Message-a-class email (needs Mailer; wizard already stubs it)
- **Members / Squads reports** — Dedicated members/squads report views

**Registration (public)**
- **Register wizard** — Payment processing at submit
- **Register wizard** — Customer confirmation email
- **Register wizard** — Re-register / EOI flows
- **Register wizard** — Hold-space pending memberships
- **Merchandise (shop form)** — Shop form type — needs Uniforms/merch + billing

**Class fees & Xero**
- **Xero** — Invoice/payment two-way sync once the ledger exists (plumbing ready)

**Payments & invoicing**
- **Invoices / Add Fee / Add Credit** — The billing engine: invoice + credit-note model
- **Invoices / Add Fee / Add Credit** — Payments w/ methods; credit auto-allocation
- **Invoices / Add Fee / Add Credit** — Pro-rata, prompt discounts, recurring, direct debit (Ezidebit), Stripe/Windcave
- **Transactions** — Real transaction ledger once the engine lands
- **Money reports** — Outstanding / Overdue / Missing / Recurring reports off the ledger
- **Email Statements** — Statement generation + send (needs ledger + Mailer)

**Attendance**
- **Attendance reports** — Club-wide attendance + non-attendance reports
- **Coach Hours** — Staff hours from sessions (payroll export)
- **Visitors** — Visitor / drop-in logging

**Mailer**
- **Bulk composer** — 3-step composer: recipients by class/custom/subscribers
- **Bulk composer** — Attachments, reply-to, CC myself
- **History** — Send history + delivery status
- **Templates** — Club email templates in Settings

**Awards**
- **Awards module** — Badge definitions + groups, sequential progression, assign, report, profile tab

**Resources**
- **Resources module** — Categorised document library w/ member visibility

**Uniforms & Merchandise**
- **Uniforms / merchandise module** — Inventory + variants + stock
- **Uniforms / merchandise module** — Merch sales via shop form; issue/return per term

**Holiday Programmes**
- **Programmes module** — Date-ranged bookable programmes w/ own windows + discounts

**Vouchers & Sponsors**
- **Vouchers** — Club-wide voucher codes redeemable at registration
- **Sponsors** — Club-level sponsor catalogue in Settings

**Competitions**
- **Full competitions engine** — Divisions, pools, rounds, games, officials
- **Full competitions engine** — Per-sport scoring + individual sessions/judging
- **Full competitions engine** — Public score entry — largest net-new build (~30 legacy tables)

**Onboarding**
- **Full club onboarding journey** — Guided first-run: club details, branding, sports, terms, programmes & classes, fees, invite staff
- **Full club onboarding journey** — Progress checklist on the dashboard until complete
- **Member onboarding** — Welcome email + login setup after registration
- **Member onboarding** — Email New Logins queue (legacy parity)
- **Data import** — CSV / legacy-FM import: people, contacts, classes, terms, fee history

**Member portal (self-service)**
- **Memberships engine** — Renewal/collection/credit engines (settings captured, not enforced)
- **Memberships engine** — Member-side purchase + tier-choice registration flow
- **Memberships engine** — Public-form coverage + discounted-price math
- **My profile self-service** — Member-facing my-profile page (own details, comms preferences)
- **My classes & registrations** — Member view of enrolled classes, upcoming sessions, registration history
- **My bookings** — Member view + manage of their venue/coach bookings
- **My invoices & payments** — Member ledger view + pay online (needs billing engine)

**National & regional**
- **Per-section affiliation** — Resolve field/rule inheritance via the GROUP's affiliation chain (not just the club's primary)
- **Cross-club people & roll-up reporting** — Regional/association/national reporting dashboards
- **Cross-club people & roll-up reporting** — NSO views of member data across clubs
- **NSO provider syncs** — GNZ / NZC / NZF / Sporty provider integrations (legacy parity)

**Help & support**
- **Article coverage** — Author articles for every module as features land
- **Contextual in-app help** — ? icon per page opening the matching article
- **Contextual in-app help** — Nav entry for /help (layout file)
- **Help chatbot** — Chat over the structured articles (the token/steps format is designed for this)

**Zoho integration**
- **Zoho Desk (support)** — Raise a support ticket from /help
- **Zoho Desk (support)** — Sync club/person context onto tickets
- **Zoho CRM** — Contact/org sync (scope to be defined with FM)

**Settings & platform**
- **Deployment smoke tests** — Wire into the deploy pipeline
- **Terminology** — Nav labels (layout file)
- **Terminology** — Hardcoded Classes-breadcrumb decision
- **Registration forms & embeds** — Public site embeds: calendar, register, book widgets
- **Financial settings** — Stripe / Ezidebit / Windcave provider config once billing lands
- **Email templates** — Template editor (with Mailer)
- **Integrations** — Stripe, Ezidebit, SparkPost, HubSpot, Kamar, NSO provider syncs
- **Permission enforcement** — Per-button Can sweep across pages
- **Permission enforcement** — Nav hiding by permission
- **Permission enforcement** — Switch Role
- **Tenant security (RLS)** — RLS policies across ~87 tables before production
- **Audit log** — Surface change history (legacy audit-logged every write)

