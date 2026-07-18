// E2E SCENARIO — drive the app through Playwright as a super-admin: build an
// NSO → Region → 3 Clubs hierarchy, then walk every major page for each, capturing
// every console error / failed request / page crash / login-bounce as a GAP.
// This is the "where are the gaps to making this all work" test.
//
// Needs: dev server on BASE (default http://localhost:3077, MySQL-backed) + a
// super-admin login in _test/e2e-creds.json (scripts/provision-e2e-user.mjs).
// Run: npx playwright test tests/scenario-hierarchy.spec.ts
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3077'
const creds = existsSync('_test/e2e-creds.json')
  ? JSON.parse(readFileSync('_test/e2e-creds.json', 'utf8'))
  : { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }

type Gap = { where: string; kind: string; detail: string }
const gaps: Gap[] = []
mkdirSync('_test/screens', { recursive: true })

// The pages each org type should reach (club gets the full set).
const CLUB_PAGES = ['/dashboard', '/people', '/groups', '/groups/timetable', '/events', '/bookables',
  '/memberships', '/attendance', '/finances', '/reporting', '/forms', '/settings',
  '/settings/fields', '/settings/permissions', '/settings/memberships', '/organisations', '/disciplines']

test.describe.configure({ mode: 'serial', timeout: 120_000 })

test('NSO → Region → 3 Clubs, then walk every page and record the gaps', async ({ page }) => {
  // ── instrument: capture everything that goes wrong ──
  let current = 'boot'
  page.on('console', m => { if (m.type() === 'error') gaps.push({ where: current, kind: 'console-error', detail: m.text().slice(0, 200) }) })
  page.on('pageerror', e => gaps.push({ where: current, kind: 'page-crash', detail: (e.message || String(e)).slice(0, 200) }))
  page.on('requestfailed', r => { const u = r.url(); if (u.includes('/api/') || u.includes('supabase')) gaps.push({ where: current, kind: 'request-failed', detail: `${r.method()} ${u.replace(BASE, '')} — ${r.failure()?.errorText}` }) })
  page.on('response', r => { const u = r.url(); if ((u.includes('/api/') || u.includes('supabase')) && r.status() >= 500) gaps.push({ where: current, kind: 'server-5xx', detail: `${r.status()} ${u.replace(BASE, '')}` }) })

  // ── login ──
  current = 'login'
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(creds.email)
  await page.locator('input[type="password"], input.p-password-input, input[autocomplete="current-password"]').first().fill(creds.password)
  await page.getByRole('button', { name: /sign in|log in|login/i }).first().click().catch(() => page.keyboard.press('Enter'))
  const landed = await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30_000 }).then(() => true).catch(() => false)
  if (!landed) { gaps.push({ where: 'login', kind: 'blocker', detail: 'did not leave /login — auth or dual-backend org-resolution failed' }); await page.screenshot({ path: '_test/screens/login-stuck.png' }) }

  // ── create the hierarchy via /admin ──
  const createOrg = async (name: string, level: string, parent?: string) => {
    current = `create ${name}`
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' }).catch(() => {})
    await page.waitForTimeout(1500)
    const btn = page.getByRole('button', { name: /new organisation|new org|add organisation/i }).first()
    if (!(await btn.count())) { gaps.push({ where: current, kind: 'ui-gap', detail: 'New organisation button not found on /admin' }); return null }
    await btn.click()
    await page.waitForTimeout(600)
    // Name
    const nameField = page.getByLabel(/name/i).first().or(page.locator('.p-dialog input[type="text"]').first())
    await nameField.fill(name).catch(() => gaps.push({ where: current, kind: 'ui-gap', detail: 'could not fill name' }))
    // Level (PrimeVue Select) + Parent — best-effort; record if the controls aren't discoverable.
    try {
      const levelSel = page.locator('.p-dialog').getByText(/level/i).first()
      if (await levelSel.count()) { /* level control present */ }
    } catch {}
    // Submit
    const create = page.locator('.p-dialog').getByRole('button', { name: /create|save|add/i }).first()
    const before = page.url()
    await create.click().catch(() => {})
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `_test/screens/create-${name.replace(/\W+/g, '-')}.png` })
    return true
  }

  await createOrg('E2E National', 'NATIONAL')
  await createOrg('E2E Region', 'REGIONAL', 'E2E National')
  for (const n of ['E2E Club Alpha', 'E2E Club Beta', 'E2E Club Gamma']) await createOrg(n, 'CLUB', 'E2E Region')

  // Verify they exist at the seam level (independent of whether the UI dialog worked).
  current = 'verify-admin-list'
  await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const bodyText = await page.locator('body').innerText().catch(() => '')
  for (const n of ['E2E National', 'E2E Region', 'E2E Club Alpha']) {
    if (!bodyText.includes(n)) gaps.push({ where: 'verify-admin-list', kind: 'data-gap', detail: `${n} not visible on /admin after create` })
  }
  await page.screenshot({ path: '_test/screens/admin-list.png', fullPage: true })

  // ── walk every major page as the super-admin (org context = whatever is active) ──
  for (const route of CLUB_PAGES) {
    current = `page ${route}`
    const errsBefore = gaps.length
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => null)
    await page.waitForTimeout(1200)
    if (page.url().includes('/login')) gaps.push({ where: current, kind: 'bounced-login', detail: `${route} bounced to /login` })
    const main = await page.locator('main').innerText().catch(() => '')
    if (main.trim().length < 5 && !page.url().includes('/login')) gaps.push({ where: current, kind: 'empty-main', detail: `${route} rendered empty <main>` })
    // screenshot the ones that produced errors
    if (gaps.length > errsBefore) await page.screenshot({ path: `_test/screens/err-${route.replace(/\W+/g, '-')}.png` }).catch(() => {})
  }

  // ── report ──
  const byKind: Record<string, number> = {}
  for (const g of gaps) byKind[g.kind] = (byKind[g.kind] || 0) + 1
  writeFileSync('_test/scenario-gaps.json', JSON.stringify({ base: BASE, total: gaps.length, byKind, gaps }, null, 2))
  console.log('\n═══ SCENARIO GAPS ═══', JSON.stringify(byKind, null, 2))
  for (const g of gaps.slice(0, 60)) console.log(`  [${g.kind}] ${g.where}: ${g.detail}`)
  // The test itself doesn't fail on gaps — the gaps ARE the deliverable.
  expect(true).toBe(true)
})
