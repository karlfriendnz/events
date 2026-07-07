// One-off admin password reset. Loads Supabase creds from process.env / .env
// itself and prints only the outcome — no secrets are emitted.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const TARGET_EMAIL = process.argv[2]
const NEW_PASSWORD = process.argv[3]
if (!TARGET_EMAIL || !NEW_PASSWORD) {
  console.error('usage: node scripts/reset-password.mjs <email> <password>')
  process.exit(1)
}

// Merge .env (if present) into the env lookup without printing anything.
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

if (!url) { console.error('No Supabase URL found in env/.env'); process.exit(2) }
if (!serviceKey) { console.error('No Supabase service/secret key found in env/.env'); process.exit(2) }

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

// Find the user by email (paginate through the admin user list).
let found = null
for (let page = 1; page <= 50 && !found; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) { console.error('listUsers failed:', error.message); process.exit(3) }
  found = (data?.users || []).find(u => (u.email || '').toLowerCase() === TARGET_EMAIL.toLowerCase())
  if (!data?.users?.length) break
}

if (!found) { console.error(`No auth user with email ${TARGET_EMAIL}`); process.exit(4) }

const { error: updErr } = await admin.auth.admin.updateUserById(found.id, { password: NEW_PASSWORD })
if (updErr) { console.error('update failed:', updErr.message); process.exit(5) }

console.log(`OK: password reset for ${found.email} (id ${found.id})`)
