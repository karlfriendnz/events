// Give <target> the same access level as <source>:
//   1. copy source's app_metadata.role (the super_admin / developer gate)
//   2. ensure target has every org_members row source has
// Loads Supabase creds from process.env / .env itself; prints only outcomes.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const SOURCE = process.argv[2]
const TARGET = process.argv[3]
if (!SOURCE || !TARGET) {
  console.error('usage: node scripts/match-access.mjs <sourceEmail> <targetEmail>')
  process.exit(1)
}

function loadDotenv() {
  const out = {}
  for (const file of ['.env', '.env.local']) {
    try {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
        if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch {}
  }
  return out
}
const env = { ...loadDotenv(), ...process.env }
const url = env.SUPABASE_URL || env.NUXT_PUBLIC_SUPABASE_URL || env.SUPABASE_PUBLIC_URL
const serviceKey = env.SUPABASE_SERVICE_KEY || env.NUXT_SUPABASE_SERVICE_KEY
  || env.SUPABASE_SERVICE_ROLE_KEY || env.NUXT_SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY
if (!url || !serviceKey) { console.error('Missing Supabase URL or service key in env/.env'); process.exit(2) }

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUser(email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error('listUsers failed:', error.message); process.exit(3) }
    const u = (data?.users || []).find(x => (x.email || '').toLowerCase() === email.toLowerCase())
    if (u) return u
    if (!data?.users?.length) break
  }
  return null
}

const src = await findUser(SOURCE)
const tgt = await findUser(TARGET)
if (!src) { console.error(`source not found: ${SOURCE}`); process.exit(4) }
if (!tgt) { console.error(`target not found: ${TARGET}`); process.exit(4) }

const srcRole = src.app_metadata?.role ?? null
const tgtRoleBefore = tgt.app_metadata?.role ?? null
console.log(`source ${src.email}: app_metadata.role = ${JSON.stringify(srcRole)}`)
console.log(`target ${tgt.email}: app_metadata.role = ${JSON.stringify(tgtRoleBefore)} (before)`)

// 1) Mirror the role (preserve target's other app_metadata keys).
if (srcRole !== tgtRoleBefore) {
  const { error } = await admin.auth.admin.updateUserById(tgt.id, {
    app_metadata: { ...(tgt.app_metadata || {}), role: srcRole },
  })
  if (error) { console.error('role update failed:', error.message); process.exit(5) }
  console.log(`  -> set target app_metadata.role = ${JSON.stringify(srcRole)}`)
} else {
  console.log('  -> role already matches, no change')
}

// 2) Mirror org_members.
const { data: srcRows, error: srcErr } = await admin.from('org_members').select('*').eq('user_id', src.id)
if (srcErr) { console.error('read source org_members failed:', srcErr.message); process.exit(6) }
const { data: tgtRows } = await admin.from('org_members').select('org_id').eq('user_id', tgt.id)
const have = new Set((tgtRows || []).map(r => r.org_id))
const toAdd = (srcRows || []).filter(r => !have.has(r.org_id)).map(r => {
  const row = { ...r, user_id: tgt.id }
  delete row.id; delete row.created_at
  return row
})
console.log(`org_members: source has ${srcRows?.length ?? 0}, target already has ${have.size}, adding ${toAdd.length}`)
if (toAdd.length) {
  const { error } = await admin.from('org_members').insert(toAdd)
  if (error) { console.error('org_members insert failed:', error.message); process.exit(7) }
}

console.log(`DONE: ${tgt.email} now matches ${src.email} access level.`)
