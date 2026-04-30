#!/usr/bin/env node
/**
 * Walks every page in the app, opens every tab/panel/wizard step it can,
 * and writes a screenshot per state into `docs/screenshots/`.
 *
 * Usage: npm run docs:capture
 *
 * Assumptions:
 *  - Dev server is running at BASE (default http://localhost:3002).
 *  - Karl's seeded account is karl@getfrello.com / Welcome1!.
 *  - There's at least one event, one bookable, one activity, one activity mode.
 *
 * Re-run anytime — every screenshot is overwritten, so the directory is the
 * latest snapshot of the app.
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'

const BASE = process.env.DOCS_CAPTURE_BASE ?? 'http://localhost:3002'
const EMAIL = process.env.DOCS_CAPTURE_EMAIL ?? 'testbot@fm-events.test'
const PASSWORD = process.env.DOCS_CAPTURE_PASSWORD ?? 'Welcome1!'
const HEADLESS = process.env.DOCS_CAPTURE_HEADED ? false : true

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'docs', 'screenshots')

const VIEWPORT = { width: 1440, height: 900 }
const FULL_PAGE = true
// Wait that little bit longer than the framework needs to settle.
const SETTLE_MS = 600

const log = (...args) => console.log('[docs:capture]', ...args)

async function shoot(page, name) {
  const safe = name.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase()
  const path = resolve(OUT, `${safe}.png`)
  await page.waitForTimeout(SETTLE_MS)
  try {
    await page.screenshot({ path, fullPage: FULL_PAGE })
    log('✓', safe)
  } catch (e) {
    log('✗', safe, '-', e.message)
  }
}

async function clickByText(page, text, opts = {}) {
  const { timeout = 2000, exact = false } = opts
  const loc = page.getByText(text, { exact }).first()
  try {
    await loc.click({ timeout })
    await page.waitForTimeout(SETTLE_MS)
    return true
  } catch {
    return false
  }
}

async function dismissPrototypeModal(page) {
  // The app shows an "Early prototype" modal once per session. Click "I understand"
  // if it's open. Repeat in case the modal mounts late.
  for (let i = 0; i < 4; i++) {
    const btn = page.getByRole('button', { name: /I understand/i }).first()
    if (await btn.count() === 0) return
    try {
      await btn.click({ timeout: 1500 })
      await page.waitForTimeout(SETTLE_MS)
      return
    } catch { /* retry */ }
  }
}

async function login(page) {
  // Capture the login screen first, while we know we're on it.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await shoot(page, 'login')

  // Auth via Supabase REST and seed the session into the page's localStorage
  // — this avoids fragile UI button-click selectors and is way faster.
  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_ANON = process.env.SUPABASE_KEY
  if (!SUPABASE_URL || !SUPABASE_ANON) throw new Error('SUPABASE_URL / SUPABASE_KEY missing in env')
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!tokenRes.ok) {
    throw new Error(`Supabase login failed: ${tokenRes.status} ${await tokenRes.text()}`)
  }
  const session = await tokenRes.json()

  // The Nuxt-Supabase module reads the session cookie. Set it via document.cookie
  // and also stash a parallel localStorage key (some flows read either).
  await page.evaluate(({ session, supabaseUrl }) => {
    const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
    const cookieValue = encodeURIComponent(JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
      expires_in: session.expires_in ?? 3600,
      token_type: 'bearer',
      user: session.user,
    }))
    document.cookie = `sb-${projectRef}-auth-token=${cookieValue}; path=/; SameSite=Lax`
    try { localStorage.setItem(`sb-${projectRef}-auth-token`, JSON.stringify(session)) } catch {}
  }, { session, supabaseUrl: SUPABASE_URL })

  // Reload so the framework picks up the new session, then dismiss the modal.
  await page.goto(`${BASE}/events`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await dismissPrototypeModal(page)
  if (page.url().includes('/login')) {
    throw new Error(`Login bypass failed — still on ${page.url()}`)
  }
  log('logged in →', page.url())
}

/** Pull the first record id of a table from Supabase (service key). */
async function fetchFirstId(supabase, table, orderColumn = 'created_at') {
  const { data } = await supabase.from(table).select('id').order(orderColumn, { ascending: false }).limit(1)
  return data?.[0]?.id ?? null
}

/** Click a tab/button by its visible text. Tries several selector flavours. */
async function clickTab(page, text, opts = {}) {
  const { timeout = 1500 } = opts
  const escaped = text.replace(/"/g, '\\"')
  const candidates = [
    // PrimeVue v4 tabs render as .p-tab on the root element
    page.locator(`.p-tab:has-text("${escaped}")`),
    page.locator(`[data-pc-name="tab"]:has-text("${escaped}")`),
    page.locator(`[role="tab"]:has-text("${escaped}")`),
    page.getByRole('tab', { name: text }),
    // Custom non-PrimeVue tab/pill buttons (e.g. /bookables pill bar)
    page.locator(`button:has-text("${escaped}")`),
  ]
  for (const loc of candidates) {
    try {
      const el = loc.first()
      if (await el.count() === 0) continue
      await el.click({ timeout })
      await page.waitForTimeout(SETTLE_MS)
      return true
    } catch { /* try next */ }
  }
  // Last-resort: walk the DOM directly and click any element whose visible
  // text matches. Bypasses Playwright locator quirks for non-standard markup.
  const clicked = await page.evaluate((needle) => {
    const wanted = needle.trim().toLowerCase()
    const seen = new Set()
    const candidates = Array.from(document.querySelectorAll(
      '[role="tab"], [data-pc-name="tab"], [data-pc-section="tab"], .p-tablist-tab, button',
    ))
    for (const el of candidates) {
      if (seen.has(el)) continue
      seen.add(el)
      const t = (el.textContent ?? '').trim().toLowerCase()
      if (t === wanted) {
        ;(el).click()
        return true
      }
    }
    return false
  }, text)
  if (clicked) {
    await page.waitForTimeout(SETTLE_MS)
    return true
  }
  return false
}

async function captureSimple(page, slug, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' })
  await shoot(page, slug)
}

/** Click each tab and screenshot — works for PrimeVue Tab and bare buttons. */
async function captureTabs(page, slug, tabLabels) {
  let dumped = false
  for (const label of tabLabels) {
    const ok = await clickTab(page, label)
    if (!ok) {
      if (!dumped) {
        const dump = await page.evaluate(() => {
          const all = Array.from(document.querySelectorAll('button, [role="tab"], .p-tab, [data-pc-name]'))
            .slice(0, 30)
            .map(el => `${el.tagName}.${String(el.className).slice(0,60)} :: "${(el.textContent ?? '').trim().slice(0,40)}"`)
          return all
        })
        log(`debug ${slug}: first ${dump.length} tab-like elements:\n  ` + dump.join('\n  '))
        dumped = true
      }
      log(`(no tab "${label}")`)
      continue
    }
    await shoot(page, `${slug}-tab-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
  }
}

async function run() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: HEADLESS })
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  const page = await ctx.newPage()
  page.on('pageerror', (err) => log('  page error:', err.message))

  log(`Base: ${BASE}`)
  log(`Out:  ${OUT}`)

  // ── 1. Auth ────────────────────────────────────────────────
  await login(page)

  // ── 2. Pick fixture ids straight from the DB ─────────────
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const eventId    = await fetchFirstId(supabase, 'events',         'created_at')
  const bookableId = await fetchFirstId(supabase, 'bookables',      'created_at')
  const activityId = await fetchFirstId(supabase, 'activities',     'created_at')
  let modeId       = null
  if (activityId) {
    const { data } = await supabase.from('activity_modes').select('id').eq('activity_id', activityId).limit(1)
    modeId = data?.[0]?.id ?? null
  }
  let formId = null
  {
    const { data } = await supabase.from('registration_forms').select('id').limit(1)
    formId = data?.[0]?.id ?? null
  }
  // First org id for the public booking page
  const { data: orgRow } = await supabase.from('organisations').select('id').limit(1)
  const orgId = orgRow?.[0]?.id ?? ''
  log('fixtures:', { eventId, bookableId, activityId, modeId, formId, orgId })

  // ── 3. Top-level pages ────────────────────────────────────
  const TOP_PAGES = [
    ['events',                  '/events'],
    ['events-new',              '/events/new'],
    ['events-new-basic',        '/events/new-basic'],
    ['events-new-advanced',     '/events/new-advanced'],
    ['events-new-multi',        '/events/new-multi'],
    ['events-reporting',        '/events/reporting'],
    ['bookables',               '/bookables'],
    ['bookings-new',            '/bookings/new'],
    ['book-public',             '/book?org=' + (orgId ?? '')],
    ['settings',                '/settings'],
    ['settings-calendars',      '/settings/calendars'],
    ['settings-venues',         '/settings/venues'],
    ['finances',                '/finances'],
    ['reporting',               '/reporting'],
    ['registration',            '/registration'],
    ['forms',                   '/forms'],
    ['forms-new',               '/forms/new'],
  ]
  for (const [slug, url] of TOP_PAGES) await captureSimple(page, slug, url)

  // ── 4. /settings — every tab ──────────────────────────────
  await page.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  await captureTabs(page, 'settings', ['General', 'Bookings', 'Events', 'People', 'Resources', 'Advanced'])

  // ── 5. /bookables — every pill tab ─────────────────────────
  await page.goto(`${BASE}/bookables`, { waitUntil: 'networkidle' })
  for (const label of ['Bookings', 'Venues', 'Activities', 'Discounts', 'Access']) {
    const ok = await clickTab(page, label)
    if (!ok) { log(`(no pill "${label}")`); continue }
    await shoot(page, `bookables-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
  }

  // ── 6. Event detail — every tab ───────────────────────────
  if (eventId) {
    await page.goto(`${BASE}/events/${eventId}`, { waitUntil: 'networkidle' })
    await shoot(page, 'event-detail')
    for (const tab of ['Overview', 'Sessions', 'Invitees', 'Attendance', 'Notes & Tasks', 'Forms', 'Comms', 'Data']) {
      const ok = await clickTab(page, tab)
      if (!ok) continue
      await shoot(page, `event-detail-tab-${tab.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
    }
  }

  // ── 7. Bookable detail — every tab ────────────────────────
  if (bookableId) {
    await page.goto(`${BASE}/bookables/${bookableId}`, { waitUntil: 'networkidle' })
    await shoot(page, 'bookable-detail')
    for (const tab of ['Bookings', 'Details', 'Availability', 'Layouts', 'Sub-venues', 'Items']) {
      const ok = await clickTab(page, tab)
      if (!ok) continue
      await shoot(page, `bookable-detail-${tab.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)
    }
  }

  // ── 8. Activity detail + mode editor ──────────────────────
  if (activityId) {
    await page.goto(`${BASE}/activities/${activityId}`, { waitUntil: 'networkidle' })
    await shoot(page, 'activity-detail')
    if (modeId) {
      await page.goto(`${BASE}/activities/${activityId}/modes/${modeId}`, { waitUntil: 'networkidle' })
      await shoot(page, 'mode-editor')
      await captureTabs(page, 'mode-editor', ['Details', 'Pricing', 'Bookings'])
    }
    await page.goto(`${BASE}/activities/${activityId}/modes/new`, { waitUntil: 'networkidle' })
    await shoot(page, 'mode-editor-new')
    await captureTabs(page, 'mode-editor-new', ['Details', 'Pricing', 'Bookings'])
  }

  // ── 8b. Existing form detail (form builder with real data) ─
  if (formId) {
    await page.goto(`${BASE}/forms/${formId}`, { waitUntil: 'networkidle' })
    await shoot(page, 'form-builder-existing')
  }

  // ── 9. Booking wizard — staff (/bookings/new) — walk steps  ─
  // Just shoot the initial step here; steps 2-7 require real data and clicks
  // that are hard to script reliably without fixtures. The first few are valuable.
  await page.goto(`${BASE}/bookings/new`, { waitUntil: 'networkidle' })
  await shoot(page, 'wizard-staff-step-activity')
  // Click first activity card if any
  const actCard = page.locator('div.cursor-pointer.transition-all').first()
  if (await actCard.count() > 0) {
    await actCard.click().catch(() => {})
    await page.waitForTimeout(SETTLE_MS)
    const next = page.locator('button:has-text("Next")').first()
    if (await next.isEnabled().catch(() => false)) {
      await next.click()
      await page.waitForTimeout(SETTLE_MS)
      await shoot(page, 'wizard-staff-step-mode')
    }
  }

  // ── 10. Form builder — both states (empty and with field selected) ─
  await page.goto(`${BASE}/forms/new`, { waitUntil: 'networkidle' })
  await shoot(page, 'form-builder-empty')
  // Click into Settings section panel
  const settingsCard = page.locator('button', { hasText: 'Settings' }).first()
  if (await settingsCard.count() > 0) {
    await settingsCard.click().catch(() => {})
    await page.waitForTimeout(SETTLE_MS)
    await shoot(page, 'form-builder-settings')
  }
  // Back, then Form section
  const back = page.locator('button[title], button').filter({ has: page.locator('.pi-chevron-left') }).first()
  if (await back.count() > 0) await back.click().catch(() => {})
  const formCard = page.locator('button', { hasText: 'Form' }).first()
  if (await formCard.count() > 0) {
    await formCard.click().catch(() => {})
    await page.waitForTimeout(SETTLE_MS)
    await shoot(page, 'form-builder-fields')
    // Switch to "Create New" tab
    const createNew = page.locator('button', { hasText: 'Create New' }).first()
    if (await createNew.count() > 0) {
      await createNew.click().catch(() => {})
      await page.waitForTimeout(SETTLE_MS)
      await shoot(page, 'form-builder-create-new')
    }
  }

  await ctx.close()
  await browser.close()

  // ── 11. Index file ────────────────────────────────────────
  const idx = `# Screenshot index\n\nGenerated by \`npm run docs:capture\` on ${new Date().toISOString()}.\n\nSource of truth — every PNG in this directory is overwritten on each run.\n`
  await writeFile(resolve(OUT, 'README.md'), idx, 'utf8')
  log('done.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
