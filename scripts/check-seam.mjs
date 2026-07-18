#!/usr/bin/env node
// SEAM GUARDRAIL — keeps the frontend from re-tangling with the backend as we build,
// so the eventual "split-out" to a standalone frontend + API contract stays a clean
// lift. The rule: pages/ and components/ must talk to the backend ONLY through the
// typed /api/v1 seam (a use*Api composable) — never the database directly.
//
// It FAILS (exit 1) if any file OUTSIDE the allow-list reads the DB directly
// (`useDb(` / `db.from(`). The allow-list is the small, deliberate set that is
// legitimately allowed to (auth, the anonymous public surface, dev-only tooling) —
// plus a few residual gaps that are flagged for cleanup but don't fail the build.
//
// Run: `npm run check:seam`  (also wired into the pre-commit hook).
import { readFileSync, readdirSync } from 'node:fs'

const FORBIDDEN = /useDb\(|\(db\.from as any\)|\bdb\.from\(/

// file → why it's allowed. Keep this list SHORT and intentional. Adding a file here
// is a conscious decision that this UI file may touch the DB directly.
const ALLOW = {
  // ── Auth (Supabase session/sign-in — NOT data; never goes through the data seam) ──
  'pages/login.vue': 'auth',
  'pages/set-password.vue': 'auth',
  'pages/clubs.vue': 'auth (signOut)',
  'pages/dashboard.vue': 'auth (db.auth.getSession only)',
  'components/BookingAuthChooser.vue': 'auth (guest sign-in / staff pick)',
  // ── Anonymous public surface (runs with no session — served by /api/v1/public/*, ──
  //    a couple of reads still resolve client-side on the embed path) ──
  'components/BookingsCalendar.vue': 'public embed path (customEvents; DB reads early-return)',
  // ── Dev-only tooling (never ships to a real user; will move behind a dev endpoint) ──
  'pages/dev/seed-items.vue': 'dev seeder',
  'pages/settings/index.vue': 'dev seed/reset utilities (seedDemoEvents/resetDatabase)',
}

// Residual gaps: allowed to still contain a direct call, but SHOULD be converted.
// They warn (don't fail) so they stay visible without blocking the build.
const GAPS = {
  'components/DisciplineLinker.vue': 'org_sport_ancestors / discipline join',
  'pages/groups/[id]/index.vue': 'a cross-domain read or two',
  'pages/people/index.vue': 'a residual read',
  'pages/registration/index.vue': 'legacy flat-form editor — slated to retire',
}

function walk(dir) {
  const out = []
  const rec = (d) => {
    for (const n of readdirSync(d, { withFileTypes: true })) {
      const p = d + '/' + n.name
      if (n.isDirectory()) rec(p)
      else if (p.endsWith('.vue') || p.endsWith('.ts')) out.push(p)
    }
  }
  try { rec(dir) } catch {}
  return out
}

const files = [...walk('pages'), ...walk('components')]
const violations = []
const gapsSeen = []
for (const f of files) {
  if (!FORBIDDEN.test(readFileSync(f, 'utf8'))) continue
  if (f in ALLOW) continue
  if (f in GAPS) { gapsSeen.push(f); continue }
  violations.push(f)
}

if (gapsSeen.length) {
  console.log(`\n⚠  ${gapsSeen.length} known residual gap(s) still on the DB (tracked, not blocking):`)
  for (const f of gapsSeen) console.log(`   · ${f} — ${GAPS[f]}`)
}

if (violations.length) {
  console.error(`\n❌ SEAM VIOLATION — ${violations.length} UI file(s) talk to the database directly:`)
  for (const f of violations) console.error(`   · ${f}`)
  console.error(`\nThe frontend must talk to the backend ONLY through the /api/v1 seam.`)
  console.error(`Replace the direct \`useDb()\`/\`db.from()\` call with a typed \`use*Api()\` composable`)
  console.error(`(add a route + repo function under server/ if the data isn't exposed yet).`)
  console.error(`This keeps the codebase split-ready — see docs/split-out-procedure.md.`)
  console.error(`If this file is genuinely allowed (auth / public / dev), add it to ALLOW in scripts/check-seam.mjs with a reason.\n`)
  process.exit(1)
}

console.log(`\n✅ Seam intact — every UI file talks to the backend through /api/v1 (${gapsSeen.length} tracked gaps, 0 new violations).`)
process.exit(0)
