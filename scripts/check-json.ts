// Verify JSON columns are stored as real JSON (ARRAY/OBJECT), not double-encoded
// strings, after a write. A proper .ts file (not tsx -e) so the static mysql2
// import + repo imports coexist cleanly.
import mysql from 'mysql2/promise'
import * as people from '../server/db/repositories/people'
import * as groups from '../server/db/repositories/groups'
import * as events from '../server/db/repositories/events'
import * as types from '../server/db/repositories/personTypes'

async function main() {
  const conn = await mysql.createConnection(process.env.MYSQL_URL ?? 'mysql://root:fmroot@127.0.0.1:3400/fm')
  const checks: [string, string][] = []
  const O = '11111111-1111-1111-1111-111111111111'

  const p = await people.createPerson({ orgId: O, firstName: 'JC', personTypes: ['member', 'coach'] } as any)
  const [pr]: any = await conn.query('SELECT JSON_TYPE(person_types) t FROM persons WHERE id=?', [p.id])
  checks.push(['persons.person_types', pr[0].t]); await people.deletePerson(p.id)

  const g = await groups.createGroup({ orgId: O, name: 'JC', locationIds: ['a', 'b'] } as any)
  const [gr]: any = await conn.query('SELECT JSON_TYPE(location_ids) t FROM member_groups WHERE id=?', [g.id])
  checks.push(['member_groups.location_ids', gr[0].t]); await groups.deleteGroup(g.id)

  const e = await events.createEvent({ orgId: O, title: 'JC', exdates: ['2026-01-01'] } as any)
  const [er]: any = await conn.query('SELECT JSON_TYPE(exdates) t FROM events WHERE id=?', [e.id])
  checks.push(['events.exdates', er[0].t]); await events.deleteEvent(e.id)

  const t = await types.createPersonType({ orgId: O, key: 'jc', label: 'JC', permissions: { view: true } } as any)
  const [tr]: any = await conn.query('SELECT JSON_TYPE(permissions) t FROM person_target_types WHERE id=?', [t.id])
  checks.push(['person_target_types.permissions', tr[0].t]); await types.deletePersonType(t.id)

  await conn.end()
  let ok = true
  for (const [col, ty] of checks) {
    const good = ty === 'ARRAY' || ty === 'OBJECT'
    if (!good) ok = false
    console.log(`${good ? '✅' : '❌'} ${col}: JSON_TYPE=${ty}`)
  }
  console.log(ok ? '\nAll JSON columns stored cleanly (not double-encoded).' : '\nSTILL double-encoded somewhere.')
  process.exit(ok ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
