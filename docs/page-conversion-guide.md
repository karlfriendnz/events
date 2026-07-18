# Page conversion guide — moving a screen onto the `/api/v1` seam

Read this in full before converting any page. It encodes what the pilot
(`pages/people/index.vue`) learned so you don't rediscover it.

## The architecture

Vue page/component → `composables/use<Domain>Api.ts` (typed `$fetch` to `/api/v1/...`)
→ `server/api/v1/**` Nitro route (Zod-validates in + out) → `server/db/repositories/<domain>.ts`
(the ONLY DB-aware layer) → Drizzle → MySQL.

**The UI must never call `useDb()` / `useSupabaseClient()` / `(db.from as any)('table')`
for any table the seam covers.** Replace every such call with a typed composable call.

Reference implementations to copy the pattern from (naming, comments, casts):
- `composables/usePeopleApi.ts`, `composables/useOrganisationsApi.ts`
- `server/api/v1/people/index.get.ts`, `server/api/v1/people/set-type.post.ts`
- `server/db/repositories/people.ts`, `server/db/repositories/organisations.ts`
- `shared/contracts/person.ts`, `shared/contracts/orgSettings.ts`

## Rules (non-negotiable)

1. **You own a fixed file list. Never write a file outside it** — especially not another
   domain's composable/repo/contract. If you need a function that doesn't exist in another
   domain, DO NOT add it there — STOP and report it as a cross-domain gap. (Two agents writing
   the same composable at once silently lose each other's work — this has bitten us.)
2. **Do NOT run git.** The main session commits everything.
3. **Every new route parses-on-output** (`schema.parse(result)` before returning), exactly like
   `people/index.get.ts`. Validate input with the contract too (400 on bad input).
4. **json columns take RAW JS values on write** — never `JSON.stringify` (Drizzle `json()`
   double-encodes). On read, tolerate both (see `asArray`/`asObj` in `people.ts`).
5. **ids via `randomUUID()`** (`node:crypto`); insert `.values({...} as any)` (schema over-requires
   notNull cols; the DB fills defaults).
6. **Bulk mutations are POST** with the id list in the body, and are **org-scoped in the WHERE**
   (`and(eq(orgId), inArray(id, ids))`) — never trust the id list alone (tenant safety).
7. **Check the repo for existing functions before writing one** — several repos are further along
   than their route/composable surface (e.g. `listLocationStaff`/`listLocations` existed with no
   route). Add only the thin route + composable in that case.
8. **Do NOT add auth** — the seam is intentionally auth-less at this stage (backend team owns it).
9. Keep behaviour, props, and UI **identical**. Only data-access changes.

## The camelCase ↔ snake_case gap (READ THIS)

The seam returns **camelCase** domain objects (`firstName`, `orgLevel`, `personTypes`). Most pages
read **snake_case** (`first_name`, `org_level`, `person_types`) because that's what Supabase returned.
Two ways to bridge — pick per page:
- **Mapper (fast, minimal diff):** map the seam result back to the shape the template expects with a
  one-liner, e.g. `const rows = people.map(p => ({ ...p, first_name: p.firstName, last_name: p.lastName, person_types: p.personTypes }))`. The pilot used this (`toRow()`). Best when the template has many refs.
- **Rewrite:** change the template/refs to camelCase. Cleaner, bigger diff. Best for small pages.

Do NOT half-convert — a page that mixes `p.firstName` and `p.first_name` will render blanks.

## Tables with no `org_id`

Some tables aren't org-scoped directly and must be scoped by joining to a parent:
`member_group_memberships` → join `member_groups` (has org_id); `permission_group_members` →
join `permission_groups`; session/fee child rows → join `events`. `location_staff` HAS org_id.
The repo function does the join and returns a small shape (see `listMembershipsByOrg` in `groups.ts`).

## `nuxt build` ≠ typecheck

`npm run build` bundles + wires (esbuild); it does NOT run `vue-tsc`. A green build proves routes
register and code bundles, not that types are sound. Annotate risky casts and lean on
parse-on-output. Still: **your conversion must build green** before you report done.

## Shared seam inventory (already built — REUSE, don't duplicate)

usePeopleApi: `list` `get` `create` `update` `remove` `setTypeForMany(orgId,ids,key|null)` `removeMany(orgId,ids)`
useOrganisationsApi: `list` `get` `create` `update` `remove` `getAncestors` `getDescendants` `getSettings(orgId)` `setPeopleColumns(orgId,cols)`
useGroupsApi: (base CRUD) + `membershipsByOrg(orgId)`
useAffiliationsApi: (base) + `locationStaffByOrg(orgId)`
useRolesApi: (base) + `permissionGroupMemberPersonIds(orgId)`
Also present (may need thin route/composable if you consume them): `listLocations`, `listLocationStaff`.
Contracts: `person` now has `photoUrl` + `personType`; `orgSettings` exists.

If a function you need is in this list, import and call it — never re-add it.

## Report back (structured, to the main session — not a human)

1. `npm run build` — PASS/FAIL (paste the final line).
2. Files created/modified, grouped by layer (contracts / repos / routes / composables / pages / components).
3. NEW seam functions added (name + one-line purpose) — for the shared inventory.
4. `useDb`/Supabase calls left in your assigned files, and why (or "0 remaining").
5. Cross-domain gaps you hit (functions you needed from a domain you don't own) — list them; the
   main session fills these serially.
6. Anything that will trip up other agents.
