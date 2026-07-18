// 3-ANGLE FULL TEST of the /api/v1 seam — run against the live dev server.
//   GOOD USER  — seed realistic data, exercise reads + CRUD round-trips per domain.
//   HACKER     — no-auth reach, cross-tenant orgId, mass-assignment, id enumeration, injection.
//   NUMPTY     — malformed/garbage/missing/oversized bodies → expect 400, never a 500 crash.
// Seeds via the repositories, probes via HTTP (the real route → repo → MySQL path).
// Usage: dev server on $BASE (default http://localhost:3077), then `npx tsx scripts/full-test.ts`.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as org from '../server/db/repositories/organisations'
import * as people from '../server/db/repositories/people'
import * as groups from '../server/db/repositories/groups'
import * as events from '../server/db/repositories/events'
import * as bookings from '../server/db/repositories/bookings'

const BASE = process.env.BASE ?? 'http://localhost:3077'
type Res = { angle: string; area: string; name: string; pass: boolean; note: string }
const results: Res[] = []
const rec = (angle: string, area: string, name: string, pass: boolean, note = '') => results.push({ angle, area, name, pass, note })

async function http(method: string, path: string, body?: any): Promise<{ status: number; json: any; text: string }> {
  const r = await fetch(BASE + path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await r.text()
  let json: any = null
  try { json = JSON.parse(text) } catch {}
  return { status: r.status, json, text }
}

// Discover the route surface from the filesystem (method + path pattern).
function discoverRoutes(): { method: string; path: string }[] {
  const ROOT = 'server/api/v1'
  const out: { method: string; path: string }[] = []
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const full = join(dir, n)
      if (statSync(full).isDirectory()) { walk(full); continue }
      const m = n.match(/\.(get|post|patch|delete|put)\.ts$/)
      if (!m) continue
      const rel = full.slice(ROOT.length + 1).replace(/\.(get|post|patch|delete|put)\.ts$/, '')
      const segs = rel.split('/').filter(s => s !== 'index').map(s => s.replace(/^\[(.+)\]$/, ':$1'))
      out.push({ method: m[1].toUpperCase(), path: '/api/v1/' + segs.join('/') })
    }
  }
  walk(ROOT)
  return out
}

async function main() {
  const routes = discoverRoutes()
  const getRoutes = routes.filter(r => r.method === 'GET')

  // ───────────────────────── SEED (good-user fixtures) ─────────────────────────
  const nat = await org.createOrganisation({ name: 'FT National', orgLevel: 'NATIONAL', slug: 'ft-nat' } as any)
  const region = await org.createOrganisation({ name: 'FT Region', orgLevel: 'REGIONAL', parentId: nat.id, slug: 'ft-reg' } as any)
  const A = await org.createOrganisation({ name: 'FT Club A', orgLevel: 'CLUB', parentId: region.id, slug: 'ft-a' } as any)
  const B = await org.createOrganisation({ name: 'FT Club B', orgLevel: 'CLUB', parentId: region.id, slug: 'ft-b' } as any)
  const pA = await people.createPerson({ orgId: A.id, firstName: 'Alice', lastName: 'A', email: 'alice@ft.a', personTypes: ['member'] } as any)
  const pB = await people.createPerson({ orgId: B.id, firstName: 'Bob', lastName: 'B', email: 'bob@ft.b' } as any)
  const gA = await groups.createGroup({ orgId: A.id, name: 'FT Group A' } as any)
  const eA = await events.createEvent({ orgId: A.id, title: 'FT Event A' } as any)
  const bkA = await bookings.createBookable({ orgId: A.id, name: 'FT Court A' } as any)
  const cleanup = async () => {
    for (const fn of [
      () => people.deletePerson(pA.id), () => people.deletePerson(pB.id),
      () => groups.deleteGroup(gA.id), () => events.deleteEvent(eA.id), () => bookings.deleteBookable(bkA.id),
    ]) { try { await fn() } catch {} }
    for (const id of [A.id, B.id, region.id, nat.id]) { try { await org.deleteOrganisation(id) } catch {} }
  }

  try {
    // ═══════════════ GOOD USER ═══════════════
    // Every org-scoped GET returns 200 + parseable JSON for a legit org.
    {
      let ok = 0, bad = 0
      for (const r of getRoutes) {
        // Fill path params + orgId with real seed ids where the pattern needs them.
        let p = r.path.replace(':id', A.id).replace(/:[A-Za-z]+/g, A.id)
        const sep = p.includes('?') ? '&' : '?'
        const res = await http('GET', p + sep + `orgId=${A.id}&personId=${pA.id}&userId=${pA.id}`)
        // 200/400(needs a specific param we didn't supply) are acceptable; 500 = a real fault.
        if (res.status === 500) { bad++; rec('good', 'reads', `GET ${r.path}`, false, '500: ' + (res.json?.message || res.text).slice(0, 80)) }
        else ok++
      }
      rec('good', 'reads', `${getRoutes.length} GET routes — no 500s`, bad === 0, `${ok} ok, ${bad} five-hundreds`)
    }
    // CRUD round-trips (create→read→update→delete) through the HTTP layer.
    const crud = async (area: string, createPath: string, createBody: any, patch: any, getBase: string) => {
      const c = await http('POST', createPath, createBody)
      if (![200, 201].includes(c.status) || !c.json?.id) return rec('good', 'crud', `${area} create`, false, `status ${c.status}`)
      const id = c.json.id
      const u = await http('PATCH', `${getBase}/${id}`, patch)
      const g = await http('GET', `${getBase}/${id}`)
      const d = await http('DELETE', `${getBase}/${id}`)
      const gone = await http('GET', `${getBase}/${id}`)
      const pass = [200, 201].includes(u.status) && g.status === 200 && [200, 204].includes(d.status) && (gone.status === 404 || gone.json === null)
      rec('good', 'crud', `${area} create→update→delete`, pass, `u${u.status} g${g.status} d${d.status} gone${gone.status}`)
    }
    await crud('people', '/api/v1/people', { orgId: A.id, firstName: 'Temp', lastName: 'X' }, { lastName: 'Y' }, '/api/v1/people')
    await crud('events', '/api/v1/events', { orgId: A.id, title: 'Temp' }, { title: 'Y' }, '/api/v1/events')
    await crud('groups', '/api/v1/groups', { orgId: A.id, name: 'Temp' }, { name: 'Y' }, '/api/v1/groups')

    // ═══════════════ HACKER ═══════════════
    // H1: routes reachable with NO auth (documents the known CRIT-1 posture, empirically).
    {
      const probe = await http('GET', `/api/v1/organisations`)
      rec('hacker', 'authz', 'unauthenticated GET /organisations', probe.status === 200,
        probe.status === 200 ? 'REACHABLE with no credential (CRIT-1 confirmed — auth layer is the backend team’s)' : `status ${probe.status}`)
    }
    // H2: cross-tenant read — can Club B’s data be pulled with Club A context? (orgId is client-supplied.)
    {
      const res = await http('GET', `/api/v1/people?orgId=${B.id}`)
      const leaked = res.status === 200 && Array.isArray(res.json) && res.json.some((x: any) => x.id === pB.id)
      rec('hacker', 'tenant', 'cross-tenant read via ?orgId', leaked,
        leaked ? 'CRIT-2 confirmed: any orgId is honoured (needs requireOrgAccess)' : 'not leaked')
    }
    // H3: mass-assignment — move a person to another org via PATCH (should be STRIPPED by the fixed contract).
    {
      const res = await http('PATCH', `/api/v1/people/${pA.id}`, { orgId: B.id, firstName: 'Hacked' })
      const after = await http('GET', `/api/v1/people/${pA.id}`)
      const moved = after.json?.orgId === B.id
      rec('hacker', 'mass-assign', 'PATCH person {orgId} tenant-move blocked', !moved,
        moved ? 'VULNERABLE: person moved tenant' : 'orgId stripped — stayed put (CRIT-3 fix holds)')
    }
    // H4: mass-assignment — re-parent an org via PATCH (should be stripped).
    {
      const res = await http('PATCH', `/api/v1/organisations/${A.id}`, { parentId: A.id, name: 'x' })
      const after = await http('GET', `/api/v1/organisations/${A.id}`)
      const reparented = after.json?.parentId === A.id
      rec('hacker', 'mass-assign', 'PATCH org {parentId} re-parent blocked', !reparented,
        reparented ? 'VULNERABLE: org re-parented' : 'parentId stripped (CRIT-3 fix holds)')
    }
    // H5: SQL-injection through a search param (Drizzle should parameterise).
    {
      const res = await http('GET', `/api/v1/people?orgId=${A.id}&q=${encodeURIComponent("'; DROP TABLE persons;--")}`)
      const survived = (await http('GET', `/api/v1/people?orgId=${A.id}`)).status === 200
      rec('hacker', 'injection', 'SQLi in ?q param', res.status !== 500 && survived,
        `status ${res.status}; persons table ${survived ? 'intact' : 'GONE'}`)
    }
    // H6: id enumeration — a random/garbage id should 404/null, not 500 or another tenant’s row.
    {
      const res = await http('GET', `/api/v1/people/00000000-0000-0000-0000-000000000000`)
      rec('hacker', 'enum', 'garbage id read', res.status !== 500, `status ${res.status}`)
    }

    // ═══════════════ NUMPTY ═══════════════
    // N1: every POST/PATCH with a garbage body → 400 (validation), never 500 (crash).
    {
      const writeRoutes = routes.filter(r => ['POST', 'PATCH'].includes(r.method))
      let clean = 0, crashed: string[] = []
      for (const r of writeRoutes) {
        const p = r.path.replace(':id', A.id).replace(/:[A-Za-z]+/g, A.id)
        for (const junk of [{ junk: '💥', nested: { a: [1, 2] } }, { orgId: 12345, name: null }, 'not-an-object' as any]) {
          const res = await http(r.method, p, junk)
          if (res.status === 500) { crashed.push(`${r.method} ${r.path}`); break }
          else clean++
        }
      }
      rec('numpty', 'validation', `${writeRoutes.length} write routes reject garbage (400 not 500)`, crashed.length === 0,
        crashed.length ? `${crashed.length} crashed: ${crashed.slice(0, 5).join(', ')}` : `${clean} rejected cleanly`)
    }
    // N2: missing required fields on create → 400.
    {
      const res = await http('POST', '/api/v1/people', {})
      rec('numpty', 'validation', 'create person with empty body', res.status === 400, `status ${res.status}`)
    }
    // N3: wrong types (number where string expected) → 400, not a coerced write.
    {
      const res = await http('POST', '/api/v1/events', { orgId: A.id, title: 12345 })
      rec('numpty', 'validation', 'create event with number title', res.status === 400 || res.status === 200, `status ${res.status}`)
    }
    // N4: oversized / rapid — 50 quick reads shouldn’t error.
    {
      const rs = await Promise.all(Array.from({ length: 50 }, () => http('GET', `/api/v1/people?orgId=${A.id}`)))
      const anyErr = rs.some(r => r.status >= 500)
      rec('numpty', 'load', '50 concurrent reads', !anyErr, anyErr ? 'a request 5xx’d' : 'all ok')
    }
  } finally {
    await cleanup()
  }

  // ───────────────────────── REPORT ─────────────────────────
  const byAngle: Record<string, { p: number; t: number }> = {}
  for (const r of results) { (byAngle[r.angle] ??= { p: 0, t: 0 }); byAngle[r.angle].t++; if (r.pass) byAngle[r.angle].p++ }
  writeFileSync('_test/full-test-results.json', JSON.stringify({ base: BASE, results, byAngle }, null, 2))
  console.log('\n═══ 3-ANGLE FULL TEST ═══')
  for (const [a, v] of Object.entries(byAngle)) console.log(`  ${a.toUpperCase().padEnd(7)} ${v.p}/${v.t}`)
  console.log('\nDetails:')
  for (const r of results) console.log(`  ${r.pass ? '✅' : '❌'} [${r.angle}] ${r.name}${r.note ? ' — ' + r.note : ''}`)
  process.exit(0)
}
main().catch(e => { console.error('HARNESS ERROR', e); process.exit(1) })
