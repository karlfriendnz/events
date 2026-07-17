import { defineConfig } from 'drizzle-kit'

// The new platform's schema lives in MySQL (the backend team's dialect), authored
// with Drizzle so what we hand over is a real, readable MySQL schema + migrations.
// Local dev points at the shared fm-legacy MySQL 8.4 server (port 3400), database
// `fm` — beside the legacy club_* databases the import script will read from.
export default defineConfig({
  dialect: 'mysql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: {
    // Its own var — DATABASE_URL is still Supabase Postgres during the transition.
    url: process.env.MYSQL_URL ?? 'mysql://root:fmroot@127.0.0.1:3400/fm',
  },
})
