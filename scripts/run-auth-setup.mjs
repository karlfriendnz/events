import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const { Client } = pg

const DB_URL = 'postgresql://postgres.hqhvuwfhnxrkeeoevvtx:tGXqYjmw4dqG3k6R@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres'

const SUPABASE_URL = 'https://hqhvuwfhnxrkeeoevvtx.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxaHZ1d2Zobnhya2Vlb2V2dnR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0ODU0OSwiZXhwIjoyMDkxNzI0NTQ5fQ.NKc_dawyUemyBWTJEPJtxM2F1KP8cn4yWtQR_lBE4-Q'

const ORG_ID = '00000000-0000-0000-0000-000000000002'

const TEAM_MEMBERS = [
  { email: 'karl@getfrello.com', password: 'Welcome1!' },
  { email: 'admin@democclub.com.au', password: 'Welcome1!' },
  { email: 'coach@democclub.com.au', password: 'Welcome1!' },
]

async function run() {
  // ── 1. Create org_members table via direct Postgres ──────────────────
  const client = new Client({ connectionString: DB_URL })
  await client.connect()
  console.log('Connected to DB')

  await client.query(`
    CREATE TABLE IF NOT EXISTS org_members (
      id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
      org_id     uuid NOT NULL,
      created_at timestamptz DEFAULT now() NOT NULL,
      UNIQUE(user_id, org_id)
    )
  `)
  console.log('✓ org_members table created')

  await client.query(`ALTER TABLE org_members ENABLE ROW LEVEL SECURITY`)
  console.log('✓ RLS enabled')

  await client.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'org_members' AND policyname = 'Users can read own memberships'
      ) THEN
        CREATE POLICY "Users can read own memberships"
          ON org_members FOR SELECT USING (auth.uid() = user_id);
      END IF;
    END $$
  `)
  console.log('✓ RLS policy created')

  await client.end()

  // ── 2. Create users via Supabase Auth Admin API ───────────────────────
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  for (const member of TEAM_MEMBERS) {
    // Create or get the user
    const { data: listData } = await supabase.auth.admin.listUsers()
    const existing = listData?.users?.find(u => u.email === member.email)

    let userId
    if (existing) {
      userId = existing.id
      console.log(`✓ User already exists: ${member.email} (${userId})`)
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: member.email,
        password: member.password,
        email_confirm: true,
      })
      if (error) { console.error(`✗ Failed to create ${member.email}:`, error.message); continue }
      userId = data.user.id
      console.log(`✓ Created user: ${member.email} (${userId})`)
    }

    // Link to org
    const { error: memberErr } = await supabase
      .from('org_members')
      .upsert({ user_id: userId, org_id: ORG_ID }, { onConflict: 'user_id,org_id' })

    if (memberErr) console.error(`✗ Failed to link ${member.email}:`, memberErr.message)
    else console.log(`✓ Linked ${member.email} → Demo Club org`)
  }

  console.log('\nAll done! Team members can now log in at /login')
  console.log('Default password for all accounts: Welcome1!')
  console.log('(Remind users to change their password after first login)')
}

run().catch(e => { console.error(e); process.exit(1) })
