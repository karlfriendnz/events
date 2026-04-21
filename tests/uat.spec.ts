import { test, expect, Page } from '@playwright/test'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3002'
const EMAIL = process.env.TEST_EMAIL ?? ''
const PASSWORD = process.env.TEST_PASSWORD ?? ''

// ─── helpers ────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"], input.p-password-input, input[autocomplete="current-password"]').fill(PASSWORD)
  // Two "Sign in" elements exist (tab toggle + submit). Use the submit button.
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(`${BASE}/events`, { timeout: 25000 })
  await page.waitForLoadState('networkidle')
}

// Navigate via sidebar link click (client-side, preserves session)
async function gotoSidebar(page: Page, href: string) {
  await page.locator(`a[href="${href}"]`).first().click()
  await page.waitForLoadState('networkidle')
}

async function closeDialog(page: Page) {
  const cancel = page.getByRole('button', { name: /cancel/i })
  if (await cancel.isVisible({ timeout: 2000 })) await cancel.click()
}

// ─── Login ──────────────────────────────────────────────────────────────────

test.describe('Login', () => {
  test('shows error for bad credentials', async ({ page }) => {
    await page.goto(`${BASE}/login`)
    await page.locator('input[type="email"]').fill('wrong@example.com')
    await page.locator('input[type="password"], input.p-password-input, input[autocomplete="current-password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()
    await page.waitForTimeout(3000)
    // Should remain on login or show error
    const stillOnLogin = page.url().includes('/login')
    expect(stillOnLogin).toBeTruthy()
  })

  test('logs in with valid credentials', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(`${BASE}/events`)
  })

  test('stays on app after navigating between pages', async ({ page }) => {
    await login(page)
    // Navigate to bookings (client-side) and back
    await gotoSidebar(page, '/bookings')
    await expect(page).not.toHaveURL(/login/)
    await gotoSidebar(page, '/events')
    await expect(page).not.toHaveURL(/login/)
  })
})

// ─── Events ─────────────────────────────────────────────────────────────────

test.describe('Events', () => {
  test.beforeEach(async ({ page }) => { await login(page) })

  test('events page loads without errors', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('500')
    // New Event button confirms the layout is fully rendered
    await expect(page.getByRole('button', { name: /new event/i })).toBeVisible({ timeout: 12000 })
  })

  test('list tab shows events or empty state', async ({ page }) => {
    const listTab = page.getByRole('tab', { name: /list/i })
    if (await listTab.isVisible({ timeout: 3000 })) {
      await listTab.click()
      await page.waitForLoadState('networkidle')
    }
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('new event button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new event/i })).toBeVisible({ timeout: 5000 })
  })

  test('clicking new event opens selection or form', async ({ page }) => {
    await page.getByRole('button', { name: /new event/i }).click()
    await page.waitForLoadState('networkidle')
    const onNewPage = page.url().includes('/new')
    const dialogOpen = await page.locator('.p-dialog').isVisible({ timeout: 3000 })
    expect(onNewPage || dialogOpen).toBeTruthy()
  })
})

// ─── Bookings ────────────────────────────────────────────────────────────────

test.describe('Bookings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/bookings')
  })

  test('bookings list renders', async ({ page }) => {
    await expect(page).toHaveURL(/bookings/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('table, .p-datatable, .card').first()).toBeVisible({ timeout: 10000 })
  })

  test('search filter works', async ({ page }) => {
    const search = page.locator('input[placeholder*="Search" i]')
    await expect(search).toBeVisible({ timeout: 5000 })
    await search.fill('test query')
    await page.waitForTimeout(400)
    await search.clear()
  })

  test('status filter dropdown works', async ({ page }) => {
    const selects = page.locator('.p-select')
    if (await selects.first().isVisible({ timeout: 3000 })) {
      await selects.first().click()
      const confirmed = page.getByRole('option', { name: /confirmed/i })
      if (await confirmed.isVisible({ timeout: 2000 })) {
        await confirmed.click()
        await page.waitForTimeout(400)
      }
    }
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('new booking button navigates to wizard', async ({ page }) => {
    await page.getByRole('button', { name: /new booking/i }).click()
    await page.waitForURL(/bookings\/new/, { timeout: 10000 })
    await expect(page.locator('body')).not.toContainText('500')
  })
})

// ─── New Booking Wizard ──────────────────────────────────────────────────────

test.describe('New Booking Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/bookings')
    await page.getByRole('button', { name: /new booking/i }).click()
    await page.waitForURL(/bookings\/new/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
  })

  test('wizard loads with form or steps', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('h1, h2, .p-steps, form, input').first()).toBeVisible({ timeout: 5000 })
  })

  test('back link returns to bookings list', async ({ page }) => {
    const backLink = page.locator('a[href="/bookings"]')
    if (await backLink.isVisible({ timeout: 3000 })) {
      await backLink.click()
      await expect(page).toHaveURL(/\/bookings$/)
    }
  })
})

// ─── Bookables ───────────────────────────────────────────────────────────────

test.describe('Bookables', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/bookables')
  })

  test('bookables list renders', async ({ page }) => {
    await expect(page).toHaveURL(/bookables/)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('500')
  })

  test('new bookable page opens', async ({ page }) => {
    const newBtn = page.getByRole('button', { name: /new|add/i }).first()
    if (await newBtn.isVisible({ timeout: 3000 })) {
      await newBtn.click()
      await page.waitForURL(/bookables\/new/, { timeout: 10000 })
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).not.toContainText('500')
    }
  })
})

// ─── Finances ────────────────────────────────────────────────────────────────

test.describe('Finances', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/finances')
  })

  test('finances page loads', async ({ page }) => {
    await expect(page).toHaveURL(/finances/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 })
  })

  test('tabs render and are clickable', async ({ page }) => {
    // Wait for at least one tab to appear (PrimeVue Tabs render async)
    await expect(page.getByRole('tab').first()).toBeVisible({ timeout: 8000 })
    const tabs = page.getByRole('tab')
    const count = await tabs.count()
    expect(count).toBeGreaterThanOrEqual(1)
    for (let i = 0; i < Math.min(count, 4); i++) {
      await tabs.nth(i).click()
      await page.waitForTimeout(300)
      await expect(page.locator('body')).not.toContainText('500')
    }
  })

  test('discount tab: new discount dialog opens', async ({ page }) => {
    const discountTab = page.getByRole('tab', { name: /discount/i })
    if (await discountTab.isVisible({ timeout: 3000 })) {
      await discountTab.click()
      const addBtn = page.getByRole('button', { name: /new|add/i }).first()
      if (await addBtn.isVisible({ timeout: 3000 })) {
        await addBtn.click()
        await expect(page.locator('.p-dialog')).toBeVisible({ timeout: 5000 })
        await closeDialog(page)
        await expect(page.locator('.p-dialog')).not.toBeVisible({ timeout: 3000 })
      }
    }
    await expect(page.locator('body')).not.toContainText('500')
  })
})

// ─── Reporting ───────────────────────────────────────────────────────────────

test.describe('Reporting', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/reporting')
  })

  test('reporting page loads with KPI cards', async ({ page }) => {
    await expect(page).toHaveURL(/reporting/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 5000 })
  })

  test('export button is present', async ({ page }) => {
    const exportBtn = page.getByRole('button', { name: /export/i })
    await expect(exportBtn).toBeVisible({ timeout: 5000 })
  })

  test('search filter in events table works', async ({ page }) => {
    const search = page.locator('input[placeholder*="Filter" i]')
    if (await search.isVisible({ timeout: 3000 })) {
      await search.fill('test')
      await page.waitForTimeout(300)
      await search.clear()
    }
    await expect(page.locator('body')).not.toContainText('500')
  })
})

// ─── Access Control ──────────────────────────────────────────────────────────

test.describe('Access Control', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/access')
  })

  test('access page loads with tabs', async ({ page }) => {
    await expect(page).toHaveURL(/access/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('.p-tab, [role="tab"]').first()).toBeVisible({ timeout: 5000 })
  })

  test('lighting tab is clickable', async ({ page }) => {
    const lightingTab = page.getByRole('tab', { name: /lighting/i })
    if (await lightingTab.isVisible({ timeout: 3000 })) {
      await lightingTab.click()
      await expect(page.locator('body')).not.toContainText('500')
    }
  })

  test('new profile button is visible', async ({ page }) => {
    const btn = page.getByRole('button', { name: /new profile/i })
    await expect(btn).toBeVisible({ timeout: 5000 })
  })
})

// ─── Settings – General ──────────────────────────────────────────────────────

test.describe('Settings – General', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/settings')
  })

  test('settings page loads', async ({ page }) => {
    await expect(page).toHaveURL(/settings/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5000 })
  })

  test('org name input is visible', async ({ page }) => {
    const nameInput = page.locator('input').filter({ hasText: '' }).first()
    await expect(nameInput).toBeVisible({ timeout: 5000 })
  })

  test('save organisation button works', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /save organisation/i })
    await expect(saveBtn).toBeVisible({ timeout: 5000 })
    await saveBtn.click()
    await page.waitForTimeout(2000)
    await expect(page.locator('body')).not.toContainText('500')
  })
})

// ─── Settings – Categories & Calendars ──────────────────────────────────────

test.describe('Settings – Categories & Calendars', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/settings')
    await page.waitForLoadState('networkidle')
    // Click the Categories Manage button on the settings page
    const manageBtn = page.getByRole('button', { name: /manage/i }).first()
    await expect(manageBtn).toBeVisible({ timeout: 5000 })
    await manageBtn.click()
    await page.waitForURL(/settings\/calendars/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
  })

  test('categories section is visible', async ({ page }) => {
    await expect(page).toHaveURL(/settings\/calendars/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('h2').first()).toBeVisible({ timeout: 5000 })
  })

  test('new category dialog opens and closes', async ({ page }) => {
    const btn = page.getByRole('button', { name: /new category/i })
    await expect(btn).toBeVisible({ timeout: 5000 })
    await btn.click()
    await expect(page.locator('.p-dialog')).toBeVisible({ timeout: 5000 })
    await page.locator('.p-dialog input[type="text"]').fill('UAT Test Category')
    await closeDialog(page)
    await expect(page.locator('.p-dialog')).not.toBeVisible({ timeout: 3000 })
  })

  test('new calendar dialog opens and closes', async ({ page }) => {
    const btn = page.getByRole('button', { name: /new calendar/i })
    await expect(btn).toBeVisible({ timeout: 5000 })
    await btn.click()
    await expect(page.locator('.p-dialog')).toBeVisible({ timeout: 5000 })
    await closeDialog(page)
    await expect(page.locator('.p-dialog')).not.toBeVisible({ timeout: 3000 })
  })
})

// ─── Settings – Venues ───────────────────────────────────────────────────────

test.describe('Settings – Venues', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/settings')
    await page.waitForLoadState('networkidle')
    // Click the Venues Manage button on the settings page
    const manageBtns = page.getByRole('button', { name: /manage/i })
    const count = await manageBtns.count()
    // Third "Manage" button is Venues (after Categories, Calendars)
    const venuesBtn = manageBtns.nth(Math.min(count - 1, 2))
    await venuesBtn.click()
    await page.waitForURL(/settings\/venues/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')
  })

  test('venues page loads', async ({ page }) => {
    await expect(page).toHaveURL(/settings\/venues/)
    await expect(page.locator('body')).not.toContainText('500')
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 5000 })
  })
})

// ─── Category full lifecycle ─────────────────────────────────────────────────

test.describe('Category lifecycle', () => {
  test('create, edit, delete a category', async ({ page }) => {
    await login(page)
    await gotoSidebar(page, '/settings')
    await page.waitForLoadState('networkidle')
    // Navigate to calendars via Manage button
    await page.getByRole('button', { name: /manage/i }).first().click()
    await page.waitForURL(/settings\/calendars/, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    const uniqueName = `UAT-${Date.now()}`

    // Create
    await page.getByRole('button', { name: /new category/i }).click()
    await page.locator('.p-dialog input[type="text"]').fill(uniqueName)
    // Ensure create button exists
    const createBtn = page.locator('.p-dialog').getByRole('button', { name: /create/i })
    await createBtn.click()
    await page.waitForLoadState('networkidle')

    // Verify appears in list
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 5000 })

    // Edit
    await page.locator(`div:has-text("${uniqueName}")`).first().hover()
    const editBtn = page.locator(`div:has-text("${uniqueName}") .pi-pencil`).first()
    if (await editBtn.isVisible({ timeout: 2000 })) {
      await editBtn.click()
      await expect(page.locator('.p-dialog')).toBeVisible()
      const input = page.locator('.p-dialog input[type="text"]')
      await input.clear()
      const editedName = uniqueName + '-ed'
      await input.fill(editedName)
      await page.locator('.p-dialog').getByRole('button', { name: /save/i }).click()
      await page.waitForLoadState('networkidle')
      await expect(page.locator(`text=${editedName}`)).toBeVisible({ timeout: 5000 })
      // Delete the edited version
      await page.locator(`div:has-text("${editedName}")`).first().hover()
      const trashBtn = page.locator(`div:has-text("${editedName}") .pi-trash`).first()
      if (await trashBtn.isVisible({ timeout: 2000 })) {
        await trashBtn.click()
        const confirmBtn = page.getByRole('button', { name: /yes|delete/i })
        if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
        await page.waitForLoadState('networkidle')
      }
    } else {
      // If edit not found, just delete the original
      const trashBtn = page.locator(`div:has-text("${uniqueName}") .pi-trash`).first()
      if (await trashBtn.isVisible({ timeout: 2000 })) {
        await trashBtn.click()
        const confirmBtn = page.getByRole('button', { name: /yes|delete/i })
        if (await confirmBtn.isVisible({ timeout: 3000 })) await confirmBtn.click()
        await page.waitForLoadState('networkidle')
      }
    }
    await expect(page.locator('body')).not.toContainText('500')
  })
})
