# FriendlyManager Rebuild — State of Play & Roadmap

## Context

We're rebuilding the full FriendlyManager platform on the `fm-events` (Nuxt 3 + Supabase) foundation. Over this session we've mapped three things: (1) what `fm-events` implements today, (2) the live platform (`demoswimming.friendlymanager.com`, crawled module-by-module), and (3) the legacy PHP codebase in `/old` (the authoritative source for data model + business rules). The detailed inventory lives in **`PLATFORM_AUDIT.md`** (Part 1 = live modules + CRUD behaviour; Part 2 = legacy architecture + revised scope). This document is the **status + roadmap** on top of that inventory, with the **multi-org federation** feature as the highlighted near-term build.

Confirmed decisions: **(a)** report = full rebuild roadmap; **(b)** tenancy = **single Postgres DB + org hierarchy** (not legacy's database-per-club). Two-way data flow and cross-org sharing are dramatically simpler in one database.

---

## 1. Where we are — `fm-events` today

`fm-events` is a working prototype that implements the **enhanced "events + bookings" slice** of the platform, and in several areas already exceeds the legacy:

| Built & solid | Notes |
|---|---|
| **Events engine** | Multi-session events, registration forms (FormBuilder), tickets, discounts, invitees, automation, reporting, attendance — far beyond legacy's basic event |
| **Booking engine** | Bookables (venue/person/item) + sub-venues + activities/modes + 3 flows (wizard/scheduler/item) + configurations + conflict/capacity + access control (doors/lights/codes) |
| **Member groups + schedules** | Groups, weekly training schedules, attendance landing, training-event series |
| **Forms** | `registration_forms` + `form_fields` + `<FormBuilder>`/`<FormFieldCanvas>`/`<BookingFormFields>` — reusable field engine with visibility conditions + financial rules |
| **Review system** | In-app prototype sign-off (`<ReviewWidget>`) |
| **Org primitives** | `organisations` (single-DB, `org_id` scoping), `org_members`, branding (`booker_theme`), season, default forms/payment |

**Architecture facts that matter for the rebuild:** single Postgres, **no RLS** (scoping is app-level `.eq('org_id', …)`, ~108 sites), `useDb()` is the plain RLS-bound client (not admin — CLAUDE.md is wrong), `bookings` has no `org_id`. See memory `[[codebase-architecture]]`, `[[booking-engine]]`, `[[claude-md-corrections]]`.

---

## 2. The target — full platform scope

From the live crawl + `/old`, the full platform is a **white-label, multi-tenant, multi-sport** system: People (CRM) · Squads + **Terms/Codes/Waitlist** · **Billing** (pro-rata, prompt discounts, subscriptions, affiliation fees, Xero, Stripe/Ezidebit/Windcave) · Events · Attendance (+coach hours) · Mailer · Awards · Resources · Uniforms/merch · Programmes · **Competitions** (draws/divisions/pools/games/officials/per-sport scoring) · Settings (terminology, module toggles, custom fields, integrations, audit) · **multi-org federation** · Compliance (waivers/vaccine/vetting) · Mobile API · public Embeds.

---

## 3. Gap analysis (built vs. needed)

| Area | fm-events today | Gap to full platform |
|---|---|---|
| Events | ✅ Strong (exceeds legacy) | Categories/calendar polish; cross-org sharing |
| Bookings/Venues | ✅ Strong | Map legacy venue/staff semantics; booking-as-event reconciliation |
| Groups/Squads | 🟡 Partial | **Terms, Codes, Waitlist, Allocation, Retention, Term-transfer** |
| People/CRM | 🟡 Partial | Rich profile tabs, reusable contacts/guardians, roles (9-level), tags, **custom-field engine** |
| Forms | ✅ Engine exists | Extend to org-scoped field definitions (see federation) |
| **Billing** | 🔴 Basic | Pro-rata, prompt discounts, subscriptions, affiliation/family discounts, Xero, Stripe/Ezidebit, credit-note allocation, statements/recurring crons |
| **Competitions** | 🔴 None | Entire module (~30+ tables) — biggest net-new |
| **Federation (multi-org)** | 🔴 Dead stub | `parent_id`/`type` exist but unused; `master_event_id`/`sharing_config` unused — **near-term build, below** |
| Attendance | 🟡 Partial | Generate-from-schedule, coach hours, visitors, non-attendance |
| Comms/Mailer | 🟡 Partial | Bulk mailer, history, subscription/bounce handling, templates |
| Awards/Resources/Uniforms/Programmes | 🔴 Mostly none | Module-toggleable secondary modules |
| Foundation | 🟡 Partial | Terminology engine, module toggles, audit log surfacing, roles, **RLS** |
| Compliance / Mobile API / Embeds / Integrations | 🔴 None | Waivers, vaccine/vetting, `/app/*` API, calendar/register/book embeds, webhooks, NSO-provider syncs |

---

## 4. Foundation decision (confirmed): single DB + org hierarchy

Model Club → Regional → Major Association → National as **`organisations` rows linked by recursive `parent_id`** in one database. Cross-org reads = scope `org_id` to the ancestor/descendant set. Harden with RLS later. This keeps fm-events' model and makes two-way flow tractable.

---

## 5. ⭐ Near-term build — Multi-org federation

**Goal:** a club connects to a chain of parents (Mount Cricket → Bay of Plenty Cricket → Northern Districts → NZC). Data flows **down** (parent-defined required fields; parent-created events a child registers into) and **up** (member data aggregates to national). All on single-DB.

### 5a. Org hierarchy (N-level chain)
- Relax `organisations.type` CHECK (currently `'NSO'|'CLUB'`) → add levels (e.g. `CLUB / REGIONAL / ASSOCIATION / NATIONAL`); keep recursive `parent_id` (already supports unlimited depth).
- New Postgres functions/recursive CTEs `org_ancestors(uuid)` and `org_descendants(uuid)`; expose via a `useOrgHierarchy()` composable.
- Settings → replace the single "National org" picker (`pages/settings/index.vue:29`) with a parent picker that renders the **resolved chain**.

### 5b. Org-defined field engine (the primary example — "NSO field required downstream")
- New table `org_field_definitions`: `id, org_id (owner), applies_to (PERSON | EVENT_REGISTRATION | BOOKING | MEMBERSHIP…), key, label, field_type (reuse form_fields enum), options jsonb, is_required, required_contexts jsonb, sort_order, status`.
- **Inheritance:** effective fields for a club = own + all ancestors (`org_ancestors`). A field NZC marks required propagates to every descendant club.
- **Answers:** reuse the inert `persons.custom_fields jsonb` (keyed by definition `key`); event/booking contexts reuse `bookings.custom_fields` / `registrations.form_answers`.
- **Render/enforce:** extend `<BookingFormFields>` (`components/BookingFormFields.vue`) + person/registration forms to merge inherited definitions and enforce `is_required` per context. Reuse field types + core-mapping + condition logic already in `FormBuilder`/`BookingWizard`.
- **Definition UI:** an org-settings "Member fields" page reusing `<FormBuilder>`/`<FormFieldAdvancedEditor>` patterns; parents define fields + the contexts they're required in.

### 5c. Top-down content sharing (parent event → child registers)
- Wire up the unused `events.master_event_id` + `sharing_config` (migration 001:166). Parent creates an event with `sharing_config.share_down=true`; descendants list shared ancestor events (`org_id IN org_ancestors AND sharing_config.share_down`) and **adopt/register** (create a local child event linked via `master_event_id`, or register members into the parent event). Pattern generalizes to comps/awards later.

### 5d. Bottom-up aggregation (member → national)
- Reporting/read scope expands `org_id` to `org_descendants(myOrg)` for parent-org users. Initially app-level (matches today's scoping); RLS as hardening.
- Multi-org membership already supported by `org_members` (unique on pair); replace the `.single()` assumption (`middleware/org.global.ts`, `plugins/auth.client.ts`) with multi-membership + an **org-switcher**.

### Federation build order
1. Hierarchy: types/levels + `org_ancestors`/`org_descendants` + chain UI.
2. Field engine: `org_field_definitions` + inheritance resolver + enforcement in `<BookingFormFields>` + definition UI.
3. Event sharing: wire `master_event_id`/`sharing_config` + descendant "register into parent event".
4. Up-flow: descendant-scoped reporting + multi-org membership/org-switcher + (later) RLS.

---

## 6. Full rebuild roadmap (prioritized)

- **Phase 0 — Federation foundation** (§5) + tenancy/roles/terminology/module-toggles/audit-log surfacing. *(field engine doubles as the general custom-field engine.)*
- **Phase 1 — Membership core:** People CRM (profile tabs, contacts/guardians, roles, tags, custom fields), Squads + **Terms/Codes/Waitlist/Allocation/Term-transfer**.
- **Phase 2 — Billing engine:** invoices/pro-rata/prompt-discounts/subscriptions/affiliation+family discounts, Stripe/Ezidebit, credit-note allocation, **Xero** sync, recurring/statement crons.
- **Phase 3 — Registration wizard:** public signup tying Terms + Squads + Fees + payment (RegForm types default/family/team/club/program/shop); embeds.
- **Phase 4 — Attendance + Comms:** generate-from-schedule, coach hours, visitors; bulk Mailer + history + templates + bounce/subscription.
- **Phase 5 — Competitions:** the large net-new module (divisions/pools/rounds/games/officials/per-sport scoring + individual sessions/judging + mobile score feed).
- **Phase 6 — Secondary + compliance:** Awards, Resources, Uniforms/merch, Programmes, Waivers, Vaccine/Vetting, Sponsors, Vouchers.
- **Phase 7 — Platform hardening:** Mobile API (`/app/*`), full embed suite, webhooks, NSO-provider/HubSpot/Kamar integrations, RLS enforcement.

---

## 7. Deliverable & verification

**Deliverable of this planning step:** save this report to the repo as **`REBUILD_ROADMAP.md`** (companion to `PLATFORM_AUDIT.md`), and update memory `[[platform-rebuild]]` with the confirmed single-DB direction. Then begin **Phase 0 / federation step 1–2** (hierarchy + field engine) as the first build.

**Verification for the federation slice (once built):**
- Migration applies (`npx supabase db push`); `org_ancestors`/`org_descendants` return correct chains for the seed Demo NSO→Club.
- Create a 4-org chain (Mount→BoP→ND→NZC); define a required PERSON field on NZC; confirm it renders + is enforced on a Mount person/registration form via Playwright on the running app (`npm run dev`, port 3002).
- Create an event on a parent org with `share_down`; confirm a child org sees and can register into it.
- No regression: existing single-org flows still work (existing Playwright `tests/uat.spec.ts`).

> Note: this plan is **scoped to delivering the report + starting Phase 0 federation**. Phases 1–7 are the roadmap, not all in this work item.

---

## ADDENDUM — Per-section affiliation (2026-06-16)

**Affiliation attaches at the section/group level, not the whole club.** A club offers multiple sports/sections (cricket, netball, football), and **each section affiliates up a different parent-org chain** — e.g. cricket → Bay of Plenty Cricket → Northern Districts → NZC; netball → its own regional body → Netball NZ. So a club is *not* a single `parent_id` chain.

Consequences for the federation model:
- `organisations.parent_id` (Build 1) correctly models the **governing-body tree** (NZC → ND → BoP → …). That stands.
- Add a **per-section affiliation layer**: a club's groups / activities / comps each reference the governing-body (and thus the chain) they affiliate to — e.g. a join table `group_affiliations(group_id, org_id)` or a `section`/`affiliated_org_id` on groups/activities.
- **Registering into a group inherits the rules + required fields of THAT group's affiliation chain.** The org-defined field-engine inheritance must resolve via `org_ancestors(group's affiliated_org)`, *not* the club's single parent. Different group ⇒ different required fields/rules.
- The org-switcher / hierarchy UI is unaffected; this is about which chain a *piece of club content* belongs to.
