// Give every module person an OLD-platform id, so links from the embed resolve.
// ensureLegacyPerson() matches on email first and only creates when there is no
// match; the resolved id is cached onto persons.legacy_person_id.
import { db, schema } from '../server/db/client.ts'
import { ensureLegacyPerson } from '../server/utils/legacyBridge.ts'
import { eq, isNull, and, isNotNull } from 'drizzle-orm'

const targets = await db.select({
  id: schema.persons.id, firstName: schema.persons.firstName,
  lastName: schema.persons.lastName, email: schema.persons.email,
}).from(schema.persons).where(and(isNull(schema.persons.legacyPersonId), isNotNull(schema.persons.email)))

console.log(`people with no old-platform id: ${targets.length}`)
const dryRun = process.argv.includes('--dry-run')
if (dryRun) {
  for (const p of targets.slice(0, 10)) console.log(`  would bridge: ${p.firstName} ${p.lastName} <${p.email}>`)
  console.log(dryRun ? '(dry run — nothing written)' : '')
  process.exit(0)
}

let matched = 0, created = 0, failed = 0
for (const p of targets) {
  const before = await db.select({ n: schema.persons.legacyPersonId })
    .from(schema.persons).where(eq(schema.persons.id, p.id)).limit(1)
  const res = await ensureLegacyPerson(p.id).catch((e: any) => ({ id: null, err: e?.message }))
  if (!res?.id) { failed++; console.log(`  FAILED ${p.firstName} ${p.lastName}: ${(res as any)?.err ?? 'no id'}`); continue }
  if (before[0]?.n) matched++
  else created++
  console.log(`  ${p.firstName} ${p.lastName} <${p.email}> -> old id ${res.id}${(res as any).ambiguous ? '  (AMBIGUOUS — needs merging by hand)' : ''}`)
}
console.log(`\nresolved: ${created + matched}   failed: ${failed}`)
process.exit(0)
