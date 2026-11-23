import AxeBuilder from '@axe-core/playwright'
import { expect, fillPosition, test, ui } from './fixtures'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('responsive layout', () => {
  for (const width of [320, 390, 768, 1024, 1280, 1920]) {
    test(`no horizontal scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('calculator/?q0=1000000000&p0=12.5&pm=9.75&c=12345678901')
      await expect(ui(page).newAvg).not.toHaveText('—')
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }

  test('stacks the form above the chart on small screens and side by side on large ones', async ({ page }) => {
    await page.goto('calculator/?q0=100&p0=50&pm=40&c=4000')
    const form = (await page.locator('#position-form').boundingBox())!
    const chart = (await page.locator('.chart-card').boundingBox())!
    const width = page.viewportSize()!.width
    if (width >= 1024) {
      expect(chart.x).toBeGreaterThan(form.x + form.width - 1)
    } else {
      expect(chart.y).toBeGreaterThan(form.y + form.height - 1)
    }
  })

  test('chart text stays readable on phones (rendered at real pixel size)', async ({ page }) => {
    await page.goto('calculator/?q0=100&p0=50&pm=40&c=4000')
    const ratio = await page.locator('#chart svg').evaluate((svg: SVGSVGElement) => {
      return svg.getBoundingClientRect().width / svg.viewBox.baseVal.width
    })
    expect(ratio).toBeGreaterThan(0.95)
    expect(ratio).toBeLessThan(1.05)
  })
})

test.describe('accessibility', () => {
  const scenarios = [
    { name: 'empty form', query: '', dark: false },
    { name: 'filled form', query: '?q0=100&p0=50&pm=40&c=4000', dark: false },
    { name: 'averaging up', query: '?q0=100&p0=40&pm=50&c=5000', dark: false },
    { name: 'filled form, dark', query: '?q0=100&p0=50&pm=40&c=4000', dark: true },
    { name: 'averaging up, dark', query: '?q0=100&p0=40&pm=50&c=5000', dark: true },
  ]

  for (const scenario of scenarios) {
    test(`no axe violations: ${scenario.name}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scenario.dark ? 'dark' : 'light' })
      await page.goto(`calculator/${scenario.query}`)
      if (scenario.query) await page.getByText('Show the curve as a table').click()
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    })
  }

  test('no axe violations with validation errors shown', async ({ page }) => {
    await page.goto('calculator/')
    await ui(page).q0.fill('abc')
    await ui(page).p0.fill('-1')
    await ui(page).pm.focus()
    await ui(page).pm.blur()
    await page.locator('#q0').focus()
    await page.locator('#q0').blur()
    await page.locator('#p0').focus()
    await page.locator('#p0').blur()
    await expect(page.locator('.field-error:visible')).toHaveCount(3)
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('the skip link moves focus to the calculator', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern')
    await page.goto('calculator/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Skip to calculator' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#calculator$/)
    await page.keyboard.press('Tab')
    await expect(ui(page).q0).toBeFocused()
  })

  test('controls can be reached in a logical tab order', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard navigation is a desktop concern')
    await page.goto('calculator/?q0=100&p0=50&pm=40&c=4000')
    await ui(page).q0.focus()
    const order: string[] = []
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      order.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.trim() || ''))
    }
    expect(order).toEqual(['p0', 'pm', 'tour-button', 'reset-button', 'capital-slider', 'capital-amount'])
  })

  test('the chart has an accessible name and description', async ({ page }) => {
    await page.goto('calculator/?q0=100&p0=50&pm=40&c=4000')
    const chart = page.getByRole('img', { name: /Averaging-down curve/ })
    await expect(chart).toBeVisible()
    await expect(chart).toHaveAccessibleDescription(/maximum possible improvement of \$10\.00/)
  })

  test('results are announced politely after a change settles', async ({ page }) => {
    await page.goto('calculator/')
    await fillPosition(page, '100', '50', '40')
    await ui(page).amount.fill('4000')
    await ui(page).amount.press('Tab')
    await expect(page.locator('#announcer')).toHaveText(
      '100 shares for $4,000.00: new average $45.00, $5.00 lower, 50% of the maximum improvement.',
    )
  })
})
