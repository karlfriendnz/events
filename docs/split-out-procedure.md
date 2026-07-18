# Split-out procedure — handing the frontend to a backend team

The plan: **keep building on our own backend** (Nuxt + `/api/v1` + MySQL) until we're
ready, then **split the codebase** so a backend team gets a clean, standalone frontend
plus the API *contract* — and builds whatever backend they want behind it. This doc is
the repeatable recipe for that split, and the rules that keep it a clean lift instead of
a cleanup project.

## The one idea: the `/api/v1` seam IS the split-line

```
  ┌──────────────── FRONTEND (handover) ────────────────┐   ┌──── BACKEND (theirs) ────┐
  pages / components / composables / layouts            │   │  server/api/v1/** routes │
        │  (only ever call use*Api composables)         │   │  server/db/repositories  │
        ▼                                                │   │  server/db/schema (MySQL)│
  composables/use*Api.ts  ── HTTP ──▶  /api/v1/**  ──────┼──▶│  (OUR reference impl)    │
        ▲                                                │   └──────────────────────────┘
  shared/contracts/*.ts  (Zod — the exact shapes, shared by both sides)
```

The frontend depends on the backend through **exactly one thing**: the set of `/api/v1`
routes and their `shared/contracts` shapes. Nothing in `pages/` or `components/` talks to
a database. That boundary is **enforced automatically** — see "Keeping it clean" below.

## What the handover package is

| Part | Files | Role |
|---|---|---|
| **Frontend app** | `pages/`, `components/`, `composables/`, `layouts/`, `middleware/`, `plugins/`, `assets/`, `nuxt.config.ts` | The UI. Talks only to `/api/v1`. |
| **The contract (the spec)** | `shared/contracts/*.ts` + the `/api/v1/**` route inventory | The interface the backend MUST implement — Zod schemas are the precise input/output shapes. |
| **Reference backend** | `server/db/repositories/*`, `server/api/v1/*`, `server/db/schema.ts`, `server/db/client.ts` | A **working** implementation (MySQL) the team can study, port, or replace. |
| **Docs** | `docs/api-reference.html` (464 routes), `docs/replumb-architecture.md`, `docs/security-audit.md`, this file | How it fits together + what still needs hardening (auth/tenant-isolation). |

## Two ways to split (pick at handover time)

**Model A — same repo, swap the backend (lowest friction).**
The team keeps the frontend + the `/api/v1` route files + `shared/contracts`, and replaces
only `server/db/` (repositories + schema + client) with their implementation — any DB, any
ORM. Everything above the repository layer is untouched. This is what the seam was designed
for: "when the backend team's API replaces this, only the repository file changes."

**Model B — separate services (clean separation).**
Extract the frontend + `shared/contracts` into a **frontend repo** (a Nuxt SPA, `ssr:false`,
that calls `/api/v1` over HTTP at a configurable base URL). The team builds a **standalone
API service** in any stack (Node, Go, Rails, …) that implements the `/api/v1` contract. The
`shared/contracts` Zod files are handed over as the authoritative spec (and can be codegen'd
to types in their language).

## The procedure (when we're ready to split)

1. **Verify the seam is clean:** `npm run check:seam` must pass (it runs on every commit
   anyway). This proves no UI file bypasses the contract.
2. **Freeze the contract:** regenerate the API reference — `npx tsx scripts/gen-api-doc.ts`
   (→ `docs/api-reference.{md,html}`, 464 routes). The `shared/contracts/*.ts` files + this
   list ARE the spec. (Enhancement worth doing at split time: emit a machine-readable
   manifest of `route → method → input schema → output schema` from the route files + contracts.)
3. **Package** per Model A or B above.
4. **Hand over:** frontend + contract spec + the reference backend + the docs. Point the team
   at `docs/security-audit.md` — the **auth + tenant-isolation layer (CRIT-1/2) is theirs to
   build**, and `/api/v1/public/**` is the deliberately-anonymous surface to allow-list.

## What the backend team must honor (per `/api/v1` route)

- **Input:** validate the request against the route's create/patch contract (return 400 on bad input).
- **Output:** return exactly the shape the read contract defines (the frontend is typed against it).
- **Semantics:** documented per route; the reference repo shows the exact behaviour.
- **Auth:** every route requires an authenticated, org-scoped caller **except** `/api/v1/public/**`
  (anonymous, read-only). This gate does not exist yet — it's the team's first job.

## Keeping it clean until then (so the split stays a lift)

The risk is **drift** — a new feature accidentally doing a direct DB call in a page, re-tangling
the layers. That's blocked automatically:

- **`scripts/check-seam.mjs`** fails the build if any `pages/` or `components/` file reads the DB
  directly (`useDb()` / `db.from()`), outside a small, intentional allow-list (auth, the anonymous
  public surface, dev-only tooling).
- It runs via **`npm run check:seam`** and in the **pre-commit hook** — so re-tangling can't be
  committed. **Add it to CI too** (`npm run check:seam` as a required check) for defence in depth.
- When you legitimately need a new UI file to touch the DB (rare — auth or a new public page),
  add it to `ALLOW` in `scripts/check-seam.mjs` **with a reason**. That keeps the allow-list the
  living, reviewed definition of the split-line.

**Net:** build whatever you want. Every commit proves the frontend still speaks only the contract,
so the day you split it out, it's a lift — not a rescue.
