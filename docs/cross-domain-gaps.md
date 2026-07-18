# Cross-domain seam gaps — serial fill worklist

# Cross-domain seam gaps — serial fill worklist

## ▶ STATUS — re-plumb at 83% (261 useDb calls left; build green)
Branch `replumb/mysql-foundation` (worktree /Users/karl/fm-replumb, DB `fm-new` :3400). ALL 14 domains have a complete typed seam. Of 261 remaining calls: **189 are deliberately-left** (auth, anonymous public booker/calendar, dev seeders, settings/index dev utilities, registration flat-editor) and only **72 are a deep convertible tail**. Excluding deliberate leaves, ~91% converted. Build green; live app still runs on Supabase for un-converted screens.

**Waves done:** wave-1 (5 small domains) · wave-2 (groups/events/bookings) · settings+infra · gap-fill wave (missing seam surface) · final cleanup wave (5 agents) · final small-seam batch (12 items). Seams built for every domain incl. attendance, communications, reviews, booking_items, calendar-writes, training-gen, etc.

**REMAINING 72-call convertible tail** (small, scattered — a final polish pass):
- EventsBoard calendars/calendar_categories writes (calendar-writes seam now EXISTS — just repoint) + org-wide separate-sessions read.
- events/[id]: bookings event-driven reads/deletes (bookings has bookingsForBookables/updateBooking — repoint), member_group_memberships-by-person+group.
- groups/[id]: forms-tab bookings @~3225, member_group_memberships @~4017.
- PersonNotes updateNote (people: add updateNote route). useOnboarding.detect (cross-domain count aggregate — build a counts endpoint or accept).
- Assorted single-call files (grep `db.from` to find; each maps to an existing Api).

**TWO OPEN DECISIONS (Karl):**
1. Dev seed/reset utilities (settings/index.vue, ~100 calls) → dedicated dev endpoint, or retire?
2. /api/v1 GET routes anonymous-capable (public embed booker/calendar + /r registration), or keep on the RLS client?
(Flat-form editor registration/index.vue — DECIDED: retire.)

**Then handoff:** backend team builds MySQL behind /api/v1 + the auth/tenant-isolation layer (security-audit CRIT-1/2, docs/security-audit.md). Dashboard: replumb-progress.html. API ref: docs/api-reference.html.

---


Gaps reported by the domain-conversion agents: a function/field one domain needs
from a domain it doesn't own. All are **guarded/documented in-code** (no build break;
the feature degrades gracefully until filled). Most auto-resolve when the owning
domain converts in wave 2; a handful are "done-domain" fills the main session does.

## Done-domain fills (main session — do after wave 1 commits)
- [ ] **organisations: `get(id)` single-org** — `useOrganisationsApi` only has `list`; disciplines page uses `list().find()` interim. (fields Fi3)
- [ ] **organisations: `setParent(orgId, parentId)` privileged route** — org patch omits parentId (CRIT-3). OrgSportsEditor mirrors primary body → parent_id; guarded no-op today. (affiliations A4)
- [ ] **orgSettings: add `currency` + theme (`bookerTheme`, `logoUrl`)** to getSettings — finances holds a local `getOrgCurrency`; forms public page needs theme. (finances F1, forms Fo12)
- [ ] **naming reconcile: person-type-links** — `domain-fields` built `linkType`/`unlinkType`; `affiliations.approveAndSeed` calls `(typesApi as any).createLink`. Align the name so pre-linking actually fires. (affiliations A1)

## Groups domain (fill when groups converts — wave 2)
- [ ] MemberGroup contract: expose singular `locationId` (mig237) alongside `locationIds[]` (mig244). (affiliations A2, forms Fo1, dashboard D3)
- [ ] `membershipsByOrg` projection: add `roles`/`role` (json). (affiliations A3, forms Fo4)
- [ ] MemberGroup: expose `waitlistId`. (forms Fo2)
- [ ] groups: "list member_groups where code_id in […]" (code-target expansion for public reg). (forms Fo3)
- [ ] groups: `membershipsForPerson(personId)` (w/ group.location_id) + membership WRITE upsert/delete (profile syncGroups). (dashboard D3, fields Fi2)

## Events domain (wave 2)
- [ ] FMEvent: add `locationType`/`address`. (forms Fo7, dashboard D1)
- [ ] Session contract: add `title`, `isRequired`, `displayOnForm`, `sortOrder`. (forms Fo8)
- [ ] events: `invitees`/registrations reads by person (profile activity). (dashboard D9)

## Bookings domain (wave 2)
- [ ] Booking contract: add `contactName` (dashboard activity cards). (dashboard D2)

## Finances domain (mostly done; remaining)
- [ ] fee_components read by event_id OR session_id (finances exposed `feeComponents(orgId)` only). (forms Fo9)
- [ ] Discount: `formText`/`modifierType`/`modifierValue`/`isActive` + eventId scoping for public active-discounts. (forms Fo10)
- [ ] transactions/communications reads for profile financial + comms widgets. (dashboard D9)

## People-links / circles / entities (wave 2)
- [ ] **useEntities → useEntitiesApi** (entities/entity_members still useDb; proto org record page depends). (fields Fi5)
- [ ] circles: widen PersonNote (`visibleTo`, `isImportant`, `dueDate`) so the profile note READ moves off useDb (writes already owned by people.ts addNote/removeNote). (dashboard D8)

## Roles / types
- [ ] roles: `personPermissionGroupIds(personId)` (person→their group ids). (dashboard D4)
- [ ] person-types: PersonType contract `profileDashboard`. (dashboard D5)
- [ ] scoped-roles resolver: `membershipRolesByPerson` + `inviteeRolesByPerson` (personByEmail already added by dashboard `findByEmail`). (fields Fi2)

## Waitlists / comms (wave 2)
- [ ] `listCommunicationTopics` core(org_id null)+org merged + `is_active` filter (FormDesigner comms-topics). (forms Fo5)
- [ ] single waitlist name by id. (forms Fo6)

## Affiliations
- [ ] locationStaff BY PERSON (only `locationStaffByOrg` exists). (dashboard D6)

## Governing / hierarchy
- [ ] **governingOrgs seam** (parent chain ∪ approved sport chains) — `useOrgFieldPolicy` still calls `useOrgHierarchy().governingOrgs`. VERIFY: admin's useOrgHierarchy conversion may already back this via `orgGoverning`; if it still hits a Supabase RPC, port `org_sport_ancestors` to a recursive CTE. (fields Fi1)

## Legacy-page decision (not a seam fill — a product call)
- [ ] **registration/index.vue flat-form editor** — `form_fields` table + `registration_forms.status`/`.tc_content` were DROPPED in MySQL. 5 useDb sites (publish + save-T&Cs) will fail against MySQL. Decide: model form_fields+status+tc_content, or retire the legacy flat editor (the designer-shape form flow supersedes it). (finances F2, forms note)

## Memberships / terms (wave 2)
- [ ] OrgTerm: `endDate` (public term-end filtering). (forms Fo11)

## Wave-2 additional gaps (discovered during groups/events/bookings conversion)
- **bookings: filtered `bookings` read** `bookings(orgId,{bookableIds[],from,to}, joins)` — every overlap/clash/calendar read is gap-blocked for lack of a bookable_id-IN + time-window server filter (appears 5×: BookingWizard, BookingScheduler, ItemBooker, BookingsCalendar, pending).
- **bookings: `updateBooking(id,{startAt,endAt})`** — calendar drag-reschedule.
- **bookings: children-of-bookable read** (`bookableChildren(id)`) — BookingsCalendar tree walk.
- **bookings: org-wide `activityModes(orgId)`** — avoids N+1 per-activity loops.
- **bookings: delete/replace event-driven bookings by event_id** — events new-basic + [id] need it.
- **ARCHITECTURAL: `/api/v1` anonymous-capability** — the public embed booker (`/book`, `BookingsCalendar` on `pages/embed/calendar.vue`) runs with NO session; the authed `/api/v1` seam can't serve it as-is. Decide: public read routes, or keep the public booker on the RLS client. Left on useDb deliberately.
- **calendar WRITES** (create/update/delete/pin-to-nav/settings/category-links) — waitlists owns `calendars` read-only; events calendar-settings drawer needs writes.
- **attendance seam** — reporting + events/groups attendance tabs (no attendance repo/routes).
- **governingOrgs seam** (`org_sport_ancestors` → govIds) — DisciplineLinker + useOrgFieldPolicy.
- **communications WRITES** — event comms tab, booking notifications inserts.

## Settings-domain gaps (discovered converting settings/**)
- **finances**: bank_accounts CRUD (index.vue payment defaults); xero_connections UPDATE/mapping route (xero.vue saveSetup — read exists).
- **memberships**: membership_plan_options CRUD (terms.vue/memberships.vue — plan BASE rows via createPlan/updatePlan/removePlan work; the per-plan OPTIONS have no route).
- **person-types**: PersonTypePatch lacks landingPath/menuItems/profileDashboard; PersonTypeCreate lacks landing/profileDashboard/min/max (fields.vue saveLanding/persistMenuItems, profile-dashboard.vue per-type write, duplicateType).
- **admin**: dashboard_templates DELETE (fields.vue resetTypeDashboard); help_articles WRITES (create/update/delete + sort_order/updated_at — /admin/help).
- **communications**: NO seam for email_templates or communication_topics (read+write); /api/v1/communications is a read-only log. communications.vue entirely on useDb.
- **roles/perms**: org permission_groups CRUD + permission_group_members get-by-group + set (only READ routes + a flat person-id list exist). permissions.vue entirely on useDb.
- **events**: EventCategory read carries no per-category event COUNT (calendars.vue loadCategories).

## Product decisions (not seam fills)
- **seedDemoEvents() + resetDatabase()** in settings/index.vue (~1250 lines, writes/deletes across ~30 tables in every domain) — build a dedicated dev seed+reset endpoint OR retire from the UI. Left on useDb.
- **registration/index.vue flat-form editor** — model form_fields+status+tc_content or retire (superseded by the designer-shape flow).
- **/api/v1 anonymous-capability** — public embed booker (/book, embed/calendar) needs it or stays on the RLS client.

## Latent bug to check
- pages/bookables/[id].vue reads `data.parent_id` off `api.bookable()` which returns camelCase (`parentId`) — likely a camel/snake mismatch left by the bookings conversion.

## Mega-file gaps (events/[id], groups/[id])
- **events: widen Session contract + create/updateSession** — the session editor reads/writes ~12 cols the contract omits (parent_session_id, is_all_day, has_waitlist, show_attendee_list, show_as_separate_event, invitee_modes, invitee_groups, eligibility, admins, description, recurrence_rule, exdates). Routing writes through the current shape silently drops them (sub-sessions + master→linked inheritance break). Session + session-level fee_components left on useDb until widened.
- **events: Invitee READ with joined person** (name/email) + `sub_group_id`/`signed_out`/`invited_at` writes — Invitee contract too thin for loadInvitees + the attendance/invitees tabs.
- **events: recurrence series** — no `recurrence_parent_id` read/count/delete/insert (generateOccurrences, series archive follow/all).
- **events: Registration reporting shape** — Registration lacks guest_name/guest_email/created_at + nested ticket-items join (reporting + ticket-order reads).
- **groups: id-preserving schedule save** — seam `saveSchedules` is delete-then-insert with fresh UUIDs → orphans `events.member_group_schedule_id`. The group page needs an update-in-place schedule route.
- **groups: memberships-with-person projection carrying custom_fields + person_types** — discipline flags need both (roster/membershipsWithPerson don't carry them).
- **groups: member_group_terms + member_group_plans WRITE** (billing tab per-term fee + plan links).
- **people: read-by-ids bulk projection** (attendance visitor names); **PersonCreate allowing null first name** (inline last-name-only add).
