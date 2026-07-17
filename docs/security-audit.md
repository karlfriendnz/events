# Security Audit — `/api/v1` re-plumbed seam

**Scope:** the typed data seam on branch `replumb/mysql-foundation` — Nitro routes in `server/api/v1/**`, repositories in `server/db/repositories/**`, `server/db/client.ts`, contracts in `shared/contracts/**`.
**Context:** commercial multi-tenant platform (a National org with 30k+ people across many clubs) about to be handed to a backend team.
**Method:** static review of the actual code + a live read-only repository probe against MySQL `fm-new` (port 3400).

## Verdict

The seam is **cleanly built at the data-mapping layer** (parameterised queries, Zod contracts on input and output, secrets excluded from the Xero contract) but has **no security layer at all**. There is **no authentication and no tenant isolation** on any `/api/v1` route. As it stands, anyone who can reach the server can read and write **every tenant's data** by passing an `orgId` query parameter. Two mass-assignment gaps additionally let a caller move records and whole orgs between tenants. These must be fixed before this ships or is handed over.

MySQL has no row-level security (app-level `org_id` scoping only, same as the Supabase side), so **the seam is the only gate** — and right now it is open.

---

## What's already safe

- **SQL injection — SAFE.** Every repository uses Drizzle's query builder (`eq`, `and`, `or`, `like`), and the two raw recursive CTEs in `organisations.ts` (`getAncestors` L91–101, `getDescendants` L108–118) use Drizzle's `sql\`` tagged template with `${id}` interpolation, which compiles to **bound placeholders** (mysql2 prepared statements), not string concatenation. The `like(..., \`%${opts.q}%\`)` in `people.ts:73` parameterises the value too — the `%` wrapping is data, not SQL. No user input is concatenated into a query anywhere I found.
- **Secret exposure — SAFE.** `xeroConnectionSchema` (`shared/contracts/finance.ts:103`) deliberately omits `refresh_token`/`access_token`; `toXeroConnection` (`finances.ts:94`) never copies them into the returned object; and parse-on-output would strip them even if it did (Zod `z.object` drops unknown keys). Tokens do not cross the boundary. *(Hardening note below to keep it that way.)*
- **Input validation on writes — PRESENT.** Every POST/PATCH parses the body with a Zod schema before touching the DB (e.g. `people/index.post.ts:8`, `people/[id].patch.ts:8`, `events/[id]/sessions.post.ts:11`). Shape and types are enforced at the boundary. *(It validates the wrong field set in two places — see HIGH-1.)*
- **Parse-on-output.** Routes validate the repository result against the read contract before returning, so the response shape can't silently drift.

---

## Findings

### CRITICAL-1 — No authentication on any `/api/v1` route
**What:** Not one route verifies the caller is logged in. Every handler is a bare `defineEventHandler` that goes straight to `getQuery`/`readBody` → repository. The only file in `server/middleware/` is `iframe-embed.ts` (sets a permissive CSP for `/book`) — there is no auth middleware. Grepping the routes for any `getUser`/`session`/`requireAuth`/`serverSupabase` check returns only false positives on *event sessions*.
**Where:** all of `server/api/v1/**` (e.g. `people/index.get.ts`, `people/index.post.ts:7`, `organisations/[id].patch.ts`, `events/[id].delete.ts`); absence confirmed in `server/middleware/`.
**Exploit:** `curl https://host/api/v1/people?orgId=<any>` returns that org's members — names, emails, phones, DOBs — with no credential. Every write route (`POST`/`PATCH`/`DELETE`) is equally open: anyone can create, edit, or delete people, events, groups, discounts, etc.
**Fix:** Add a Nitro server middleware that runs on `/api/v1/**`, verifies the session (the app already carries a Supabase JWT; `server/utils/supabaseAdmin.ts` exists to validate it), resolves the authenticated user, and rejects with 401 when absent. Attach the resolved user/`org_members` to `event.context` for the authorization layer below. No route should be reachable anonymously except a deliberately public allow-list (e.g. the public booker), which should be explicit, not the default.

### CRITICAL-2 — No tenant isolation: `orgId` is a trusted query param
**What:** Routes take `orgId` from the query string and pass it directly to the repository with **no check that the authenticated user belongs to that org**. This is the core multi-tenant failure: even once auth exists, a valid user of Club A can read/write Club B by changing `?orgId=`.
**Where:** `people/index.get.ts:10,18`, `events/index.get.ts:12,16`, `xero-connection/index.get.ts:9,13`, and essentially every `index.get.ts`; the single-record routes (`[id].get/patch/delete`) take a bare `id` with no org scoping at all (e.g. `people/[id].patch.ts`, `events/[id].delete.ts`).
**Live proof:** an unauthenticated `npx tsx` probe called `listOrganisations()` → returned the full org list (1 org, "football nz", in this dev DB) with **no caller context**, then `listPeople(thatOrgId)` returned rows for it. The dev DB is lightly seeded (0 people), but the mechanism is proven: the repository honours **any** `orgId` handed to it. In production that is every club's roster across a 30k-person National org.
**Exploit:** enumerate orgs via `GET /api/v1/organisations` (unbounded, unauthenticated), then `GET /api/v1/people?orgId=<victim>` for each → full cross-tenant data exfiltration. Same param on write routes → cross-tenant tampering.
**Fix:** Authorization must be enforced server-side from the session, never from the request. Add a helper — `requireOrgAccess(event, orgId)` — that checks the authenticated user's `org_members`/permission rows include `orgId` (or an ancestor org for governing-body access) and throws 403 otherwise; call it in every route before the repository. For `[id]` routes, load the record, derive its `orgId`, and run the same check (don't trust an `orgId` in the body). Consider pushing `orgId` scoping down into the repository signature so a route physically cannot query cross-tenant.

### CRITICAL-3 — Mass assignment: records and whole orgs can be moved between tenants
**What:** The patch schemas are `createSchema.partial()`, so they include the tenant-linking fields, and the repositories write them blindly.
- `personPatchSchema = personCreateSchema.partial()` includes **`orgId`** (`shared/contracts/person.ts:55` — create keeps `orgId`, patch inherits it), and `updatePerson` writes it: `if (patch.orgId !== undefined) set.orgId = patch.orgId` (`people.ts:126`). → `PATCH /api/v1/people/:id {"orgId":"<victim>"}` **moves a person into another tenant** (or, combined with CRIT-2, steals a victim's person into the attacker's org).
- `organisationPatchSchema` allows **`parentId`**, and `updateOrganisation` writes it (`organisations.ts:55`). → `PATCH /api/v1/organisations/:id {"parentId":"<any>"}` **re-parents any org anywhere in the hierarchy** — graft an attacker org under a victim NSO (inherit its context), or reparent a victim club under the attacker to gain governing-body reach over it. `id` and `parentId` have no cycle/ownership guard here.
**Where:** `people.ts:126`, `organisations.ts:55`; schemas `shared/contracts/person.ts:55`, `shared/contracts/organisation.ts` (patch).
**Exploit:** cross-tenant record theft and hierarchy manipulation, even by an otherwise-legitimate low-privilege user.
**Fix:** Never accept tenant-defining fields on update. Give patch its own explicit schema that omits `orgId` (person) and `parentId`/`id` (org), or `.omit()` them from the derived patch schema. Reparenting an org and moving a person between orgs are privileged administrative operations — if needed, expose them as separate, permission-checked endpoints, not as a field on the general PATCH.

### HIGH-1 — Unbounded list endpoints (resource exhaustion / exfil amplification)
**What:** Several list routes/repos have no pagination cap. `listOrganisations` (`organisations.ts:23`) has **no `limit` at all**. `listPeople`/`listEvents` accept an *optional* limit with **no default and no maximum** (`people.ts:86`, `people/index.get.ts:14`) — omit it and you get every row. `admin.ts` has 6 list functions with zero `.limit()` calls. With 30k+ people, a single `GET /api/v1/people?orgId=X` (no limit) loads and serialises the whole table per request.
**Where:** `organisations.ts:23`; `people.ts:64–91`; `events/index.get.ts`; `admin.ts` (6 unbounded list fns).
**Exploit:** cheap DoS (memory pressure / slow queries by repeated full-table pulls) and it maximises the blast radius of CRIT-2 (one request = whole-tenant dump). Negative/huge `Number(limit)` values are also passed through unchecked.
**Fix:** Enforce a default page size and a hard maximum (e.g. default 50, max 200) in the route, clamp `offset`, reject non-finite/negative values, and give every `list*` repo a mandatory bounded `limit`. Return a total count / next-cursor so the UI can page.

### MEDIUM-1 — Error leakage via unhandled Zod / DB errors
**What:** Parse-on-output (`personListSchema.parse(...)`) throws a `ZodError` if the repo drifts, and mysql2 throws on DB faults; nothing catches these, so they surface as 500s. Zod messages include field paths (schema/shape disclosure) and DB errors can include SQL/column text. There is no global error handler normalising responses.
**Where:** every route's trailing `schema.parse(...)`; repository DB calls.
**Exploit:** an attacker probing malformed input or triggering a constraint error learns internal schema/column/SQL detail — reconnaissance that aids the attacks above.
**Fix:** Add a Nitro error handler (`nitroApp.hooks.hook('error', …)` or a wrapper) that logs the full error server-side and returns a generic `{ statusCode, message }` to the client. Ensure `parse` failures map to 500 with a generic message; validate *input* with `safeParse` and return a 400 with field-level messages that are intentional, not raw Zod dumps.

### MEDIUM-2 — Unauthenticated org-hierarchy enumeration
**What:** `GET /api/v1/organisations/:id/descendants` (and `/ancestors`) returns the entire governing subtree (org ids, names, slugs, levels, parent links) for **any** id, with no auth (`organisations/[id]/descendants.get.ts`). Even before row data, this leaks the full commercial topology — which clubs sit under which NSO.
**Where:** `organisations/[id]/descendants.get.ts`, `organisations/[id]/ancestors.get.ts`, backed by `organisations.ts:90,107`.
**Exploit:** anonymous mapping of every National org's structure; a target list for CRIT-2.
**Fix:** covered by CRIT-1/CRIT-2 (require auth + membership on the root org); listing here so it isn't missed when the fix is scoped.

### LOW-1 — Hardcoded fallback DB credential (incl. `root`)
**What:** `server/db/client.ts:16` falls back to `mysql://root:fmroot@127.0.0.1:3400/fm` when `MYSQL_URL` is unset — a real (dev) credential, and the **root** user, committed in source. A production deploy that forgets to set `MYSQL_URL` silently reaches for `root`.
**Where:** `server/db/client.ts:16`.
**Fix:** Remove the fallback (or gate it to `NODE_ENV !== 'production'`); throw on missing `MYSQL_URL` in production. Use a least-privilege app DB user, never `root`. Keep credentials out of source entirely.

### LOW-2 — Xero repo loads secret columns then discards them (keep it airtight)
**What:** `getXeroConnection` does `db.select()` (all columns, including `refresh_token`/`access_token`) and relies on `toXeroConnection` + the contract to drop them. Correct today, but one careless future edit to the mapper or contract would leak tokens.
**Where:** `finances.ts:210` + `toXeroConnection` (`finances.ts:94`).
**Fix:** Select only the columns the contract needs (explicit projection), so secrets are never in the result set in the first place. Defense in depth over the (currently correct) mapper.

---

## Priority for the backend team

1. **CRIT-1 + CRIT-2 together** — add the `/api/v1/**` auth middleware and a `requireOrgAccess(event, orgId)` gate on every route. Nothing else matters until this exists; it is the whole multi-tenant security model.
2. **CRIT-3** — strip `orgId`/`parentId`/`id` from patch schemas; make reparent/move privileged endpoints.
3. **HIGH-1** — enforce default + max page size on all list routes/repos.
4. **MEDIUM-1/2, LOW-1/2** — global error handler, then the hardening items.

The mapping layer underneath (parameterised queries, contracts, secret omission) is sound and does not need rework — the missing piece is the entire authn/authz layer around it.
