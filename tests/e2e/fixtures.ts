import { test as base, expect, type Page } from '@playwright/test'

/** Fails any test that logs a console error or throws an uncaught exception. */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(String(error)))
      await use(errors)
      expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export function ui(page: Page) {
  return {
    q0: page.getByLabel('Shares held'),
    p0: page.getByLabel('Average buy price'),
    pm: page.getByLabel('Current price'),
    slider: page.locator('#capital-slider'),
    amount: page.getByLabel('Amount', { exact: true }),
    capitalPanel: page.locator('#capital-panel'),
    capitalDisplay: page.locator('#capital-display'),
    capitalPct: page.locator('#capital-pct'),
    amountNote: page.locator('#capital-amount-note'),
    stats: page.locator('#stats'),
    newAvg: page.locator('#stat-new-avg'),
    newAvgSub: page.locator('#stat-new-avg-sub'),
    delta: page.locator('#stat-delta'),
    deltaSub: page.locator('#stat-delta-sub'),
    capital: page.locator('#stat-capital'),
    capitalSub: page.locator('#stat-capital-sub'),
    shares: page.locator('#stat-shares'),
    efficiency: page.locator('#stat-efficiency'),
    chart: page.locator('#chart svg'),
    tooltip: page.locator('#chart .tooltip-text'),
    cursor: page.locator('#chart .cursor'),
    sliderMax: page.locator('#slider-max'),
  }
}

export async function fillPosition(page: Page, q0: string, p0: string, pm: string): Promise<void> {
  const { q0: a, p0: b, pm: c } = ui(page)
  await a.fill(q0)
  await b.fill(p0)
  await c.fill(pm)
}

/** Parses "$4,026.00" / "100" into a number. */
export function money(text: string | null): number {
  return Number((text ?? '').replace(/[$,]/g, ''))
}
