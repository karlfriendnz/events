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

const url = process.env.MYSQL_URL ?? 'mysql://root:fmroot@127.0.0.1:3399/fm'

// A pool, reused across warm Nitro invocations rather than a connection per request.
const pool = mysql.createPool(url)

export const db = drizzle(pool, { schema, mode: 'default' })
export { schema }
