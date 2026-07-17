// Phase 0 proof: the exact runtime path the app will use — Drizzle → mysql2 →
// MySQL 8.4 — writing and reading a real row in the `fm` database. If this passes,
// the seam's inside works; the Nitro routes are just wiring on top.
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db, schema } from '../server/db/client'

async function main() {
  const id = randomUUID()
  await db.insert(schema.organisations).values({ id, name: 'Smoke Test National', orgLevel: 'NATIONAL' })
  const [row] = await db.select().from(schema.organisations).where(eq(schema.organisations.id, id))
  console.log('inserted + read back:', row)
  const all = await db.select().from(schema.organisations)
  console.log(`organisations in fm: ${all.length}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
