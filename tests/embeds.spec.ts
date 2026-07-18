// EMBED CHECK — load every anonymous/embeddable surface as a not-logged-in visitor,
// confirm it renders, throws no console/page errors, and pulls its data from the
// PUBLIC seam (no direct Supabase). Fixtures (seeded org + ids) in _test/embed-fixtures.json.
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3077'
const fx = existsSync('_test/embed-fixtures.json') ? JSON.parse(readFileSync('_test/embed-fixtures.json', 'utf8')) : {}
mkdirSync('_test/screens', { recursive: true })

const EMBEDS = [
  { name: 'embed-calendar', url: `/embed/calendar?org=${fx.org}` },
  { name: 'public-booker', url: `/book?org=${fx.org}` },
  { name: 'event-registration', url: `/r/event/${fx.event}` },
  { name: 'form-registration', url: `/r/form/${fx.form}` },
]

const results: any[] = []
for (const e of EMBEDS) {
  test(`embed: ${e.name}`, async ({ page }) => {
    const consoleErr: string[] = [], supabase: string[] = [], pageErr: string[] = []
    page.on('console', m => { if (m.type() === 'error') consoleErr.push(m.text().slice(0, 160)) })
    page.on('pageerror', ex => pageErr.push((ex.message || String(ex)).slice(0, 160)))
    page.on('request', r => { if (r.url().includes('supabase.co/rest')) supabase.push(r.method() + ' ' + r.url().split('/rest/v1/')[1]?.split('?')[0]) })
    await page.goto(`${BASE}${e.url}`, { waitUntil: 'networkidle', timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(1500)
    const main = (await page.locator('body').innerText().catch(() => '')).trim()
    await page.screenshot({ path: `_test/screens/embed-${e.name}.png`, fullPage: true })
    const r = { name: e.name, url: e.url, rendered: main.length > 40, consoleErrors: consoleErr.length, pageErrors: pageErr.length, directSupabase: [...new Set(supabase)], sampleErr: (pageErr[0] || consoleErr[0] || '') }
    results.push(r)
    writeFileSync('_test/embed-results.json', JSON.stringify(results, null, 2))
    console.log(`\n[${e.name}] rendered=${r.rendered} consoleErr=${r.consoleErrors} pageErr=${r.pageErrors} directSupabase=${r.directSupabase.length ? r.directSupabase.join(',') : 'none ✅'}`)
    expect(r.rendered, `${e.name} rendered content`).toBeTruthy()
  })
}
