// The ONE place the app opens a MySQL connection. Every Nitro route (and every
// seed/import script) imports `db` from here — never mysql2 directly, never
// Supabase. This is the inside of the seam: swap what's behind it (Supabase today
// elsewhere, the backend team's MySQL API later) without touching callers.
//
// Reads process.env.MYSQL_URL — its OWN var, distinct from DATABASE_URL, which is
// still the existing Supabase Postgres connection during the dual-backend
// transition (migrated screens use this MySQL seam, un-migrated ones stay on
// Supabase). Works identically in Nitro (Nuxt loads .env) and standalone tsx
// scripts. The local-dev fallback points at the shared fm-legacy server;
// production/Vercel MUST set MYSQL_URL (no creds shipped).
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import * as schema from './schema'

// In production MYSQL_URL is mandatory — never fall back to a committed dev
// credential (and never to `root`); a missing var must fail loudly, not silently
// reach for root@localhost (security audit LOW-1). The dev fallback is local-only.
const url = process.env.MYSQL_URL
  ?? (process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('MYSQL_URL must be set in production') })()
    : 'mysql://root:fmroot@127.0.0.1:3400/fm')

// A pool, reused across warm Nitro invocations rather than a connection per request.
// `decimalNumbers: true` — mysql2 returns DECIMAL columns as JS numbers, not strings.
// Postgres/Supabase returned money as numbers; without this the UI's `amount.toFixed()`
// / numeric maths break on every fee/price/total. Fixes the whole class at the source.
//
// A HOSTED MySQL (PlanetScale / TiDB / managed) requires TLS; the local Docker dev DB
// (127.0.0.1) does not. Detect by host so dev is untouched and prod connects securely.
let dbHost = ''
try { dbHost = new URL(url).hostname } catch { /* keep '' → treated as local */ }
const isLocalDb = dbHost === '' || dbHost === 'localhost' || dbHost === '127.0.0.1'
const pool = mysql.createPool({
  uri: url,
  decimalNumbers: true,
  ...(isLocalDb ? {} : { ssl: { rejectUnauthorized: true } }),
})

export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
