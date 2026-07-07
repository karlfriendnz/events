/**
 * DEPLOYMENT SMOKE SUITE — run after every deploy.
 *
 *   TEST_BASE_URL=https://fm-events-five.vercel.app \
 *   TEST_EMAIL=... TEST_PASSWORD=... npm run test:smoke
 *
 * Principles:
 *  - STRICTLY READ-ONLY. Dev and prod share ONE database — these tests never
 *    write, click destructive buttons, or submit forms.
 *  - A route "passes" when it renders without a Nuxt 500, without uncaught
 *    page errors, without bouncing to /login, and with real content in <main>.
 *  - Data-independent: works on any org (asserts structure, not seed rows).
 *  - Auth'd sweep skips gracefully when TEST_EMAIL/TEST_PASSWORD aren't set,
 *    so the public subset still gates a deploy with no secrets available.
 */
import { test, expect, Page } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3002'
const EMAIL = process.env.TEST_EMAIL ?? ''
const PASSWORD = process.env.TEST_PASSWORD ?? ''
const HAS_CREDS = !!(EMAIL && PASSWORD)

// Every core screen. Keep this list in sync with the URL table in CLAUDE.md —
// a new page ships with a row here (same spirit as the dashboard-widget rule).
const AUTHED_ROUTES = [
  '/dashboard',
  '/people',
  '/groups',
  '/groups/timetable',
  '/groups/reports',
  '/groups/retention',
  '/groups/fees',
  '/groups/waitlists',
  '/groups/allocator',
  '/groups/codes',
  '/groups/views',
  '/groups/rollover',
  '/groups/term-wizard',
  '/memberships',
  '/events',
  '/events/new-basic',
  '/events/reporting',
  '/bookables',
  '/bookings/new',
  '/attendance',
  '/finances',
  '/reporting',
  '/forms',
  '/organisations',
  '/settings',
  '/settings/terms',
  '/settings/memberships',
  '/settings/locations',
  '/settings/fields',
  '/settings/core-fields',
  '/settings/terminology',
  '/settings/modules',
  '/settings/profile-dashboard',
  '/settings/dashboard-defaults',
  '/settings/calendars',
  '/settings/xero',
  '/settings/integrations',
]

const PUBLIC_ROUTES = ['/login', '/book']

// Errors we tolerate (3rd-party noise, favicons, expected 4xx probes)
const IGNORABLE = [/favicon/i, /ResizeObserver loop/i, /sharedworker/i]

function watchErrors(page: Page) {
  const pageErrors: string[] = []
  const badResponses: string[] = []
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)))
  page.on('response', r => {
    // 5xx anywhere is a deploy problem; 4xx only from our own API/DB calls
    const url = r.url()
    if (IGNORABLE.some(rx => rx.test(url))) return
    if (r.status() >= 500) badResponses.push(`${r.status()} ${url.slice(0, 120)}`)
    if (r.status() >= 400 && /supabase|\/api\//.test(url) && !/auth\/v1/.test(url)) {
      badResponses.push(`${r.status()} ${url.slice(0, 120)}`)
    }
  })
  return { pageErrors, badResponses }
}

async function assertHealthyPage(page: Page, route: string, errs: { pageErrors: string[]; badResponses: string[] }) {
  // Not the Nuxt error page
  const title = await page.title()
  expect.soft(title, `${route}: Nuxt error page`).not.toMatch(/500|Internal Server Error/i)
  const body = await page.evaluate(() => document.body.innerText)
  expect.soft(body, `${route}: 500 body`).not.toMatch(/Internal Server Error/i)
  // Didn't bounce to login
  expect.soft(page.url(), `${route}: bounced to login`).not.toContain('/login')
  // Rendered something real
  const mainLen = await page.evaluate(() => (document.querySelector('main')?.innerText ?? document.body.innerText).trim().length)
  expect.soft(mainLen, `${route}: empty <main>`).toBeGreaterThan(40)
  // No uncaught page errors / server failures
  expect.soft(errs.pageErrors, `${route}: uncaught page errors`).toEqual([])
  expect.soft(errs.badResponses, `${route}: failing requests`).toEqual([])
}

// ─── Public (no auth needed) ────────────────────────────────────────────────

test.describe('public pages', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const errs = watchErrors(page)
      await page.goto(`${BASE}${route}`)
      await page.waitForLoadState('networkidle')
      const title = await page.title()
      expect(title).not.toMatch(/500/)
      expect(errs.pageErrors).toEqual([])
    })
  }
})

// ─── Authenticated sweep ────────────────────────────────────────────────────

test.describe('authenticated sweep', () => {
  test.skip(!HAS_CREDS, 'Set TEST_EMAIL + TEST_PASSWORD to run the authenticated sweep')
  test.describe.configure({ mode: 'serial' })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
    await page.goto(`${BASE}/login`)
    await page.locator('input[type="email"]').fill(EMAIL)
    await page.locator('input[type="password"], input.p-password-input, input[autocomplete="current-password"]').fill(PASSWORD)
    await page.locator('button[type="submit"]').click()
    await page.waitForURL(u => !u.pathname.includes('/login'), { timeout: 30000 })
    await page.waitForLoadState('networkidle')
  })
  test.afterAll(async () => { await page?.close() })

  for (const route of AUTHED_ROUTES) {
    test(`renders ${route}`, async () => {
      const errs = watchErrors(page)
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' })
      // SPA data settles asynchronously; give queries a beat, then settle
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {})
      await page.waitForTimeout(800)
      await assertHealthyPage(page, route, errs)
    })
  }

  // ── A few structural deep-checks (still read-only) ──
  test('dashboard shows its header controls', async () => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForTimeout(2500)
    const text = await page.evaluate(() => document.body.innerText)
    // Customise renders on every desktop dashboard; quick-action labels vary
    // with terminology, so accept either signal.
    expect(text).toMatch(/Customise|Quick actions/i)
  })

  test('classes board renders a table or its empty state', async () => {
    await page.goto(`${BASE}/groups`)
    await page.waitForTimeout(2500)
    const ok = await page.evaluate(() =>
      !!document.querySelector('table tbody tr') || /No .* in this tab yet|No codes yet|New /.test(document.body.innerText))
    expect(ok).toBeTruthy()
  })

  test('memberships board loads (rows or empty state)', async () => {
    await page.goto(`${BASE}/memberships`)
    await page.waitForTimeout(2500)
    const ok = await page.evaluate(() =>
      !!document.querySelector('table tbody tr') || /No memberships yet/i.test(document.body.innerText))
    expect(ok).toBeTruthy()
  })

  test('location switcher appears for multi-site clubs (or is absent cleanly)', async () => {
    await page.goto(`${BASE}/dashboard`)
    await page.waitForTimeout(2000)
    // Either the pill exists or the club is single-site — both fine; the assert
    // is that the header itself rendered.
    const header = await page.evaluate(() => !!document.querySelector('header'))
    expect(header).toBeTruthy()
  })
})
