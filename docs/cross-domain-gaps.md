# Cross-domain seam gaps — serial fill worklist

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
