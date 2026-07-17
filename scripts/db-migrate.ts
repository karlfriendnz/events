// Apply the generated Drizzle migrations to the target MySQL database. Same client
// the app uses, so it honours DATABASE_URL. Run: `npx tsx scripts/db-migrate.ts`.
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { db } from '../server/db/client'

async function main() {
  await migrate(db, { migrationsFolder: './server/db/migrations' })
  console.log('migrations applied')
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
