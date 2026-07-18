// EVERY-PAGE SWEEP — log in once, then visit EVERY route and flag anything that
// 500s, throws a console/page error, bounces to login, or renders an empty <main>.
// The check that would have caught "orgs not loading". Results → _test/all-pages-results.json.
//   BASE=http://localhost:3077 npx playwright test tests/all-pages.spec.ts
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3077'
const creds = existsSync('_test/e2e-creds.json') ? JSON.parse(readFileSync('_test/e2e-creds.json', 'utf8')) : { email: process.env.TEST_EMAIL, password: process.env.TEST_PASSWORD }
const fx = existsSync('_test/page-fixtures.json') ? JSON.parse(readFileSync('_test/page-fixtures.json', 'utf8')) : {}
mkdirSync('_test/screens', { recursive: true })

// Every route. :id-style routes carry a fixture token; a route whose token is empty is skipped.
const ROUTES: string[] = [
  '/dashboard', '/people', `/people/${fx.person}`, '/account', '/account/profiles',
  '/events', `/events/${fx.event}`, '/events/new-basic', '/events/new-advanced', '/events/new-multi', '/events/reporting',
  '/programme', '/groups', '/groups/timetable', '/groups/allocator', '/groups/codes', '/groups/fees', '/groups/retention',
  '/groups/rollover', '/groups/views', '/groups/waitlists', '/groups/term-wizard', `/groups/${fx.group}`,
  '/memberships', '/attendance', '/bookables', `/bookables/${fx.bookable}`, '/bookables/new', '/bookables/new-v2',
  '/bookings', '/bookings/new', '/bookings/pending',
  '/finances', '/reporting', '/registration', '/forms', '/forms/new', `/forms/${fx.form}`,
  '/organisations', '/disciplines', '/managers', '/resources', '/resources/library', '/assets',
  '/settings', '/settings/fields', '/settings/terminology', '/settings/permissions',
  '/settings/memberships', '/settings/terms', '/settings/modules', '/settings/locations',
  '/settings/affiliations', '/settings/calendars', '/settings/venues', '/settings/xero', '/settings/integrations',
  '/settings/profile-dashboard', '/settings/communications',
  '/admin', '/admin/master', '/admin/permissions', '/help', '/me', '/onboarding',
].filter(u => !/\/(undefined|null|)$/.test(u) && !u.includes('/undefined') && !u.endsWith('/'))

type Row = { route: string; status: string; consoleErrors: number; pageErrors: number; api5xx: string[]; note: string }
const rows: Row[] = []
const flush = () => writeFileSync('_test/all-pages-results.json', JSON.stringify({ base: BASE, total: rows.length, bad: rows.filter(r => r.status !== 'ok').length, rows }, null, 2))

test.describe.configure({ mode: 'serial', timeout: 600_000 })

test('every page loads without a 500 / crash', async ({ page }) => {
  // login
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
  await page.locator('input[type="email"]').first().fill(creds.email)
  const pw = page.locator('input[type="password"], input.p-password-input').first()
  await pw.fill(creds.password)
  await page.locator('button:has-text("Sign in"), button[type="submit"]').last().click().catch(() => {})
  await pw.press('Enter').catch(() => {})
  const ok = await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30_000 }).then(() => true).catch(() => false)
  expect(ok, 'login succeeded').toBeTruthy()

  for (const route of ROUTES) {
    if (route.includes('/undefined') || /\/$/.test(route)) continue
    const cErr: string[] = [], pErr: string[] = [], api5: string[] = []
    const onC = (m: any) => { if (m.type() === 'error') cErr.push(m.text().slice(0, 140)) }
    const onP = (e: any) => pErr.push((e.message || String(e)).slice(0, 140))
    const onR = (r: any) => { const u = r.url(); if (u.includes('/api/') && r.status() >= 500) api5.push(`${r.status()} ${u.replace(BASE, '').split('?')[0]}`) }
    page.on('console', onC); page.on('pageerror', onP); page.on('response', onR)
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 25_000 }).catch(() => {})
    await page.waitForTimeout(900)
    const bounced = page.url().includes('/login')
    const main = (await page.locator('main').innerText().catch(() => '')).trim()
    const status = api5.length ? 'API_5XX' : pErr.length ? 'PAGE_CRASH' : bounced ? 'BOUNCED_LOGIN' : (main.length < 5 ? 'EMPTY' : cErr.length ? 'CONSOLE_ERR' : 'ok')
    if (status !== 'ok') await page.screenshot({ path: `_test/screens/page-${route.replace(/[\/:]+/g, '_')}.png` }).catch(() => {})
    rows.push({ route, status, consoleErrors: cErr.length, pageErrors: pErr.length, api5xx: [...new Set(api5)], note: (api5[0] || pErr[0] || cErr[0] || '') })
    flush()
    page.off('console', onC); page.off('pageerror', onP); page.off('response', onR)
  }

  const bad = rows.filter(r => r.status !== 'ok')
  console.log(`\n═══ EVERY-PAGE SWEEP: ${rows.length - bad.length}/${rows.length} clean ═══`)
  for (const r of bad) console.log(`  ❌ ${r.route} [${r.status}] ${r.api5xx.join(',') || r.note}`)
  // don't hard-fail on empty/console (data-dependent); DO fail on 500s/crashes.
  const hard = rows.filter(r => r.status === 'API_5XX' || r.status === 'PAGE_CRASH')
  expect(hard, `pages with 500s or crashes: ${hard.map(h => h.route).join(', ')}`).toHaveLength(0)
})
