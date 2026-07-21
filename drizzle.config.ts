import { defineConfig } from 'drizzle-kit'

// The new platform's schema lives in MySQL (the backend team's dialect), authored
// with Drizzle so what we hand over is a real, readable MySQL schema + migrations.
// Local dev points at the shared fm-legacy MySQL 8.4 server (port 3400), database
// `fm` — beside the legacy club_* databases the import script will read from.
// A hosted MySQL (TiDB / PlanetScale / managed) requires TLS; the local Docker dev
// DB (127.0.0.1) does not. Detect by host so `drizzle-kit push` works against both
// (mirrors the same conditional-TLS logic in server/db/client.ts).
const mysqlUrl = process.env.MYSQL_URL ?? 'mysql://root:fmroot@127.0.0.1:3400/fm'
let mysqlHost = ''
try { mysqlHost = new URL(mysqlUrl).hostname } catch { /* keep '' → treated as local */ }
const isLocalMysql = mysqlHost === '' || mysqlHost === 'localhost' || mysqlHost === '127.0.0.1'

// drizzle-kit ignores `ssl` when a `url` is provided, so a hosted DB that mandates
// TLS (TiDB) needs the discrete-credentials form. Local dev keeps the plain url.
const dbCredentials = isLocalMysql
  ? { url: mysqlUrl }
  : (() => {
      const u = new URL(mysqlUrl)
      return {
        host: u.hostname,
        port: Number(u.port) || 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.slice(1),
        ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      }
    })()

export default defineConfig({
  dialect: 'mysql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  // Its own var — DATABASE_URL is still Supabase Postgres during the transition.
  dbCredentials,
})
