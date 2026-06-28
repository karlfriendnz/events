import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hqhvuwfhnxrkeeoevvtx.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaHZ1d2Zobnhya2Vlb2V2dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0ODU0OSwiZXhwIjoyMDkxNzI0NTQ5fQ.NKc_dawyUemyBWTJEPJtxM2F1KP8cn4yWtQR_lBE4-Q'

const TARGET_EMAIL = 'karl@getfrello.com'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function run() {
  // Find the auth user by email (paginate through the admin list)
  let target = null
  let page = 1
  while (!target) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    if (!data.users.length) break
    target = data.users.find(u => (u.email || '').toLowerCase() === TARGET_EMAIL.toLowerCase())
    page++
    if (data.users.length < 200) break
  }

  if (!target) {
    console.error(`No auth user found for ${TARGET_EMAIL}`)
    process.exit(1)
  }

  const existingMeta = target.app_metadata || {}
  console.log(`Found ${TARGET_EMAIL} (${target.id}). Current role:`, existingMeta.role ?? '(none)')

  const { data, error } = await supabase.auth.admin.updateUserById(target.id, {
    app_metadata: { ...existingMeta, role: 'super_admin' },
  })
  if (error) throw error

  console.log('Updated. New app_metadata.role:', data.user.app_metadata?.role)
}

run().catch(e => { console.error(e); process.exit(1) })
