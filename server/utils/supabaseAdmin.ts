// Resolve the Supabase admin (service-role) credentials from whichever env var
// names are configured. Production sets NUXT_SUPABASE_SECRET_KEY (the
// @nuxtjs/supabase convention); local .env uses SUPABASE_SERVICE_KEY. We fall
// back across the known names so every server endpoint works in all envs.
// Auto-imported by Nuxt (server/utils) — no import needed in handlers.
export function serviceKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_KEY
    || process.env.NUXT_SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NUXT_SUPABASE_URL
}
