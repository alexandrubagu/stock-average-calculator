import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test, ui } from './fixtures'

// These tests start as a first-time visitor.
test.use({ tourSeen: false })

const tourDialog = (page: Page, name?: string) => page.getByRole('dialog', name ? { name } : undefined)

test.describe('guided tour', () => {
  test('starts on the first visit, walks through an example and clears it at the end', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('calculator/')
    const u = ui(page)
    const next = page.getByRole('button', { name: 'Next' })

    await expect(tourDialog(page, 'Shares held')).toBeVisible()
    await expect(page.locator('.tour-progress')).toHaveText('Step 1 of 8')
    await expect(u.q0).toHaveValue('100')

    await next.click()
    await expect(tourDialog(page, 'Average buy price')).toBeVisible()
    await expect(u.p0).toHaveValue('50')

    await next.click()
    await expect(tourDialog(page, 'Current price')).toBeVisible()
    await expect(u.pm).toHaveValue('40')

    await next.click()
    await expect(tourDialog(page, 'The curve')).toBeVisible()
    await expect(page.locator('#chart .curve-line')).toBeVisible()

    await next.click()
    await expect(tourDialog(page, 'Choose an amount')).toBeVisible()
    await expect(u.capitalDisplay).toHaveText('$4,000.00')

    await next.click()
    await expect(tourDialog(page, 'Read the result')).toContainText(
      'Your new average is $45.00, $5.00 lower than before: 50% of the maximum possible improvement.',
    )
    await expect(u.newAvg).toHaveText('$45.00')
    await expect(u.delta).toHaveText('$5.00')

    await next.click()
    await expect(tourDialog(page, 'Diminishing returns')).toContainText('$36,000, 9 times as much')
    await expect(u.newAvg).toHaveText('$41.00')
    await expect(u.deltaSub).toHaveText('90% of max')

    await next.click()
    await expect(tourDialog(page, 'Your turn')).toBeVisible()
    await page.getByRole('button', { name: 'Finish' }).click()

    await expect(tourDialog(page)).toHaveCount(0)
    for (const field of [u.q0, u.p0, u.pm]) await expect(field).toHaveValue('')
    await expect(u.capitalPanel).toBeHidden()
    await expect(page).toHaveURL(`${test.info().project.use.baseURL!}calculator/`)

    // Seen once: no automatic tour on the next visit.
    await page.reload()
    await page.waitForTimeout(1000)
    await expect(tourDialog(page)).toHaveCount(0)
  })

  test('animates the example values and the slider', async ({ page }) => {
    await page.goto('calculator/')
    const u = ui(page)
    await expect(tourDialog(page, 'Shares held')).toBeVisible()
    await expect(u.q0).toHaveValue('100')

    // Jump to "Choose an amount" and let the slider animation run.
    const next = page.getByRole('button', { name: 'Next' })
    for (let i = 0; i < 4; i++) await next.click()
    await expect(tourDialog(page, 'Choose an amount')).toBeVisible()
    await expect(u.capitalDisplay).toHaveText('$4,000.00')
    await expect(u.newAvg).toHaveText('$45.00')
  })

  test('Back and Next work in the middle of an animation', async ({ page }) => {
    await page.goto('calculator/')
    const u = ui(page)
    const next = page.getByRole('button', { name: 'Next' })
    await expect(tourDialog(page, 'Shares held')).toBeVisible()

    // Skip ahead without waiting for any typing or sliding to finish.
    for (let i = 0; i < 5; i++) await next.click()
    await expect(tourDialog(page, 'Read the result')).toBeVisible()
    await expect(u.newAvg).toHaveText('$45.00')

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(tourDialog(page, 'Choose an amount')).toBeVisible()
    await expect(u.capitalDisplay).toHaveText('$4,000.00')

    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Back' }).click()
    await expect(tourDialog(page, 'Average buy price')).toBeVisible()
    await expect(u.p0).toHaveValue('50')
    await expect(u.pm).toHaveValue('')
  })

  test('does not start by itself when the page is opened from a shared link', async ({ page }) => {
    await page.goto('calculator/?q0=10&p0=20&pm=15')
    await page.waitForTimeout(1000)
    await expect(tourDialog(page)).toHaveCount(0)
  })

  test('"How it works" replays the tour; Escape closes it and restores the previous values', async ({ page }) => {
    await page.goto('calculator/?q0=10&p0=20&pm=15&c=150')
    const u = ui(page)
    await expect(u.newAvg).not.toHaveText('—')
    const before = await u.newAvg.innerText()

    await page.getByRole('button', { name: 'How it works' }).click()
    await expect(tourDialog(page, 'Shares held')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Next' })).toBeFocused()
    await expect(page.locator('main')).toHaveAttribute('inert', '')

    await page.keyboard.press('Escape')
    await expect(tourDialog(page)).toHaveCount(0)
    await expect(page.locator('main')).not.toHaveAttribute('inert')
    await expect(u.q0).toHaveValue('10')
    await expect(u.p0).toHaveValue('20')
    await expect(u.pm).toHaveValue('15')
    await expect(u.newAvg).toHaveText(before)
    await expect(page.getByRole('button', { name: 'How it works' })).toBeFocused()
    await expect(page).toHaveURL(/\?q0=10&p0=20&pm=15&c=150$/)
  })

  test('"Skip tour" ends the tour and remembers it', async ({ page }) => {
    await page.goto('calculator/')
    await expect(tourDialog(page)).toBeVisible()
    await page.getByRole('button', { name: 'Skip tour' }).click()
    await expect(tourDialog(page)).toHaveCount(0)
    await expect(ui(page).q0).toHaveValue('')
    expect(await page.evaluate(() => localStorage.getItem('tour-seen'))).toBe('1')
  })

  test('keeps the highlighted element visible next to the popover', async ({ page, isMobile }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('calculator/')
    const next = page.getByRole('button', { name: 'Next' })
    const popover = page.locator('.tour-popover')
    const targets = ['#q0', '#p0', '#pm', '.chart-card', '#capital-panel', '#stats', '.chart-card', '#tour-button']
    const mustNotCover = new Set(['#q0', '#p0', '#pm', '#tour-button'])

    for (const [i, selector] of targets.entries()) {
      await expect(page.locator('.tour-progress')).toHaveText(`Step ${i + 1} of 8`)
      await page.waitForTimeout(50)
      const target = (await page.locator(selector).boundingBox())!
      const box = (await popover.boundingBox())!
      const viewport = page.viewportSize()!
      // The popover is fully on screen and does not cover the highlighted element.
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
      const overlaps =
        box.x < target.x + target.width && target.x < box.x + box.width && box.y < target.y + target.height && target.y < box.y + box.height
      if (mustNotCover.has(selector)) expect(overlaps, `step ${i + 1} covers ${selector}`).toBe(false)
      expect(target.y, `step ${i + 1}: ${selector} is on screen`).toBeGreaterThanOrEqual(0)
      if (isMobile) await expect(popover).toHaveClass(/is-docked/)
      if (i < targets.length - 1) await next.click()
    }
  })

  test('has no accessibility violations while open', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('calculator/')
    await expect(tourDialog(page, 'Shares held')).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .include('.tour-popover')
      .analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
})
