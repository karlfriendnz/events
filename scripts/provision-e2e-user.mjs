// Provision (or remove) a TEMPORARY super-admin auth user for the Playwright E2E
// scenario. Deliberately bounded + clearly-named so it's easy to spot and delete.
// Run with the env loaded:  node --env-file=.env scripts/provision-e2e-user.mjs [--delete]
// Prints ONLY the email + outcome — never the service key.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.NUXT_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_KEY || process.env.NUXT_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = 'e2e-super@fmreplumb.test'
const PASSWORD = 'E2e-Replumb-' + 'Test1!' // static, test-only, non-prod domain

if (!url || !key) { console.error('MISSING_ENV: need SUPABASE_URL + service key in .env'); process.exit(2) }
const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

async function findUser() {
  // list + filter (admin.listUsers has no email filter in older versions)
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find(u => u.email === EMAIL)
    if (u) return u
    if (data.users.length < 200) break
  }
  return null
}

const del = process.argv.includes('--delete')
try {
  const existing = await findUser()
  if (del) {
    if (existing) { await admin.auth.admin.deleteUser(existing.id); console.log('DELETED', EMAIL) }
    else console.log('ALREADY_ABSENT', EMAIL)
    process.exit(0)
  }
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD, email_confirm: true, app_metadata: { role: 'super_admin' },
    })
    console.log('UPDATED', EMAIL)
  } else {
    const { error } = await admin.auth.admin.createUser({
      email: EMAIL, password: PASSWORD, email_confirm: true, app_metadata: { role: 'super_admin' },
    })
    if (error) throw error
    console.log('CREATED', EMAIL)
  }
  // Emit the creds for the Playwright run via a gitignored file (not stdout beyond email).
  const { writeFileSync } = await import('node:fs')
  writeFileSync('_test/e2e-creds.json', JSON.stringify({ email: EMAIL, password: PASSWORD }, null, 2))
  console.log('creds → _test/e2e-creds.json')
} catch (e) {
  console.error('PROVISION_ERROR', e.message)
  process.exit(1)
}
