# Re-plumb architecture — the seam

**Why:** this frontend will be handed to a backend team who build a **MySQL** backend. Today it talks to Supabase (Postgres) directly from ~177 files — every one hard-wired to Postgres + PostgREST + array semantics, none of which survives the move. The re-plumb puts a **typed seam** between the UI and the data so the backend can be swapped by changing one layer, not 177 files.

This document is the standard every migrated surface follows, and the reference the backend team implements against.

## The seam

```
Vue component
    │  (only ever calls a typed composable — NEVER useDb / Supabase / raw $fetch to a table)
    ▼
composables/use<Thing>Api.ts        typed $fetch to /api/v1/*, returns domain objects
    ▼
server/api/v1/<thing>/*.ts          Nitro route: validates in/out against the Zod contract
    ▼
server/db/repositories/<thing>.ts   the ONLY code that knows how a thing is stored; maps row <-> domain
    ▼
server/db/client.ts  →  Drizzle  →  MySQL 8.4         (swap-point: backend team's MySQL API replaces this)
```

**The rule:** a migrated component imports a `use<Thing>Api()` composable and nothing else data-related. No `useDb()`, no `db.from()`, no `db.rpc()`, no Supabase. If a screen still needs Supabase it isn't migrated yet — that's fine during the transition, but it doesn't get to half-migrate.

## Layers

| Layer | Location | Owns | Never |
|---|---|---|---|
| Contract | `shared/contracts/*.ts` | Zod schema + inferred domain type. DB-neutral shape the UI codes against. | knows about the DB |
| Composable | `composables/use*Api.ts` | typed `$fetch` to `/api/v1/*` | touches the DB or Supabase |
| Route | `server/api/v1/**` | HTTP, auth/scope checks, validate in + **parse output** against the contract | business rules, raw SQL |
| Repository | `server/db/repositories/*.ts` | the only place that knows storage; row↔domain mapping; the queries | HTTP concerns |
| Client | `server/db/client.ts` | the single MySQL connection (`MYSQL_URL`) | being imported by components |

## Porting rules (Postgres → MySQL)

The old Supabase schema leans on Postgres features MySQL doesn't have. Every one has a fixed rule so 90 tables port consistently:

| Postgres | MySQL | Notes |
|---|---|---|
| `uuid` PK, `gen_random_uuid()` | `char(36)`, generated in app (`crypto.randomUUID()`) | MySQL can't default a uuid() |
| `text[]` / `uuid[]` array | **`json` column** by default; a **join table** only when it must be queried/filtered relationally at scale | e.g. `person_types`, `roles`, `applies_to` → json. The pure logic already treats these as `string[]`, so the domain type is unchanged. |
| `jsonb` | `json` | |
| recursive RPC (`org_ancestors`, `org_descendants`, `org_sport_ancestors`) | **recursive CTE** in the repository (`WITH RECURSIVE`) | MySQL 8 supports these. No `db.rpc`. |
| PostgREST embedded select (`from('a').select('b!fk(...)')`) | explicit `JOIN` / a second query in the repository | none of PostgREST exists on MySQL |
| partial index | plain index + a `WHERE` in the query | |
| generated column | computed in the repository mapper | |
| `CHECK (x in (...))` enum | plain `varchar`, validated by the **Zod contract** at the boundary | set changes without a migration |

**Domain types stay DB-neutral.** A person has `personTypes: string[]` regardless of whether it's stored as json, a Postgres array, or a join table. The UI and the pure logic (`expandTypeKeys`, `castFor`, …) never change; only the repository mapper knows the storage.

## Environments

- **Local dev:** MySQL 8.4 in the shared `fm-legacy` Docker container (port **3399**), database **`fm`**. `MYSQL_URL` in `.env`. The legacy import sources (`club_*`) live on the same server.
- **`DATABASE_URL` stays Supabase Postgres** during the transition — migrated screens use `MYSQL_URL` via the seam, un-migrated ones stay on Supabase, `main` stays green and testers keep the deploy.
- **Shared testing / prod:** Vercel (Nitro as functions) + a hosted MySQL, `MYSQL_URL` set in Vercel env.

## Migrations & tooling

- Schema authored in `server/db/schema.ts` (Drizzle, MySQL dialect). `npx drizzle-kit generate` → SQL in `server/db/migrations/` (a deliverable). `npx tsx scripts/db-migrate.ts` applies.
- `npx tsx scripts/db-seed.ts` seeds `fm`.
- Scripts run through `server/db/client.ts` — same connection the app uses.

## Handoff package (accumulates as we go)

The backend team receives: this document · the Drizzle schema + generated MySQL migrations · the OpenAPI contract (generated from the Zod contracts) · the reference Nitro server · seed data · the passing test suite as an executable spec.
