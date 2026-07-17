// Seed the `fm` database with a small governing hierarchy so screens have real
// data to render while we migrate. Idempotent: clears organisations, reseeds.
// Run: `npx tsx scripts/db-seed.ts`.
import { randomUUID } from 'node:crypto'
import { db, schema } from '../server/db/client'

async function main() {
  await db.delete(schema.organisations)
  const nat = randomUUID(), region = randomUUID(), club = randomUUID(), club2 = randomUUID()
  await db.insert(schema.organisations).values([
    { id: nat, name: 'Football New Zealand', slug: 'football-nz', orgLevel: 'NATIONAL', parentId: null },
    { id: region, name: 'Auckland Football', slug: 'auckland-football', orgLevel: 'REGIONAL', parentId: nat },
    { id: club, name: 'Mount Sports', slug: 'mount-sports', orgLevel: 'CLUB', parentId: region },
    { id: club2, name: 'Harbourside United', slug: 'harbourside-united', orgLevel: 'CLUB', parentId: region },
  ])
  const all = await db.select().from(schema.organisations)
  console.log(`seeded ${all.length} organisations into fm`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
