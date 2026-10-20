import { expect, fillPosition, money, test, ui } from './fixtures'

test.describe('initial render', () => {
  test('starts empty, like the original, with the placeholder chart', async ({ page }) => {
    await page.goto('./')
    const u = ui(page)

    await expect(page).toHaveTitle(/Stock Average Calculator/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stock Average Calculator')
    for (const [input, placeholder] of [
      [u.q0, '100'],
      [u.p0, '50.00'],
      [u.pm, '40.00'],
    ] as const) {
      await expect(input).toHaveValue('')
      await expect(input).toHaveAttribute('placeholder', placeholder)
    }
    await expect(page.getByText('Enter your position to see the curve')).toBeVisible()
    await expect(u.capitalPanel).toBeHidden()
    await expect(u.stats).toBeHidden()
    await expect(page.locator('.field-error:visible')).toHaveCount(0)
  })
})

test.describe('inputs and validation', () => {
  test('shows an error only after the field is left, and clears it when fixed', async ({ page }) => {
    await page.goto('./')
    const { q0 } = ui(page)
    const error = page.locator('#q0-error')

    await q0.fill('abc')
    await expect(error).toBeHidden()
    await q0.blur()
    await expect(error).toBeVisible()
    await expect(error).toContainText('whole number ≥ 1')
    await expect(q0).toHaveAttribute('aria-invalid', 'true')
    await expect(q0).toHaveAttribute('aria-describedby', /q0-error/)

    await q0.fill('100')
    await expect(error).toBeHidden()
    await expect(q0).toHaveAttribute('aria-invalid', 'false')

    await q0.fill('0')
    await expect(error).toHaveText('Must be a whole number ≥ 1.')
  })

  test('price fields explain how to fix comma-formatted numbers', async ({ page }) => {
    await page.goto('./')
    const { p0 } = ui(page)
    await p0.fill('1,234.50')
    await p0.blur()
    await expect(page.locator('#p0-error')).toContainText('dot for decimals')
  })

  test('pressing Enter validates every field instead of reloading', async ({ page }) => {
    await page.goto('./')
    const { q0 } = ui(page)
    await q0.fill('100')
    await q0.press('Enter')
    await expect(page.locator('#p0-error')).toBeVisible()
    await expect(page.locator('#pm-error')).toBeVisible()
    await expect(q0).toHaveValue('100')
  })

  test('computes the curve once all three inputs are valid', async ({ page }) => {
    await page.goto('./')
    const u = ui(page)
    await fillPosition(page, '100', '50', '40')

    await expect(u.capitalPanel).toBeVisible()
    await expect(u.sliderMax).toHaveText('$36k')
    await expect(page.locator('#slider-mid')).toHaveText('← 90% of max at $36k')
    await expect(page.locator('#chart .curve-line')).toHaveAttribute('d', /^M /)
    await expect(page.locator('#chart .asymptote-label')).toHaveText('max $10.00')
    await expect(u.newAvg).toHaveText('—')
    await expect(u.cursor).toHaveAttribute('visibility', 'hidden')
  })

  test('editing each input updates the result', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=4000')
    const u = ui(page)
    await expect(u.newAvg).toHaveText('$45.00')

    await u.q0.fill('300') // bound becomes 9 × 300 × 40 = 108,000; 4,000 still buys 100 shares
    await expect(u.newAvg).toHaveText('$47.50')
    await u.p0.fill('60') // (300·60 + 4000) / 400
    await expect(u.newAvg).toHaveText('$55.00')
    await u.pm.fill('50') // 80 shares: (18000 + 4000) / 380
    await expect(u.newAvg).toHaveText('$57.89')
    await expect(u.shares).toHaveText('80')
  })

  test('keeps the amount while an input is invalid and re-clamps it afterwards', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=30000')
    const u = ui(page)
    await u.pm.fill('')
    await expect(u.capitalPanel).toBeHidden()
    await u.pm.fill('20') // new bound 18,000
    await expect(u.capitalDisplay).toHaveText('$18,000.00')
    await expect(u.shares).toHaveText('900')
  })
})

test.describe('capital controls', () => {
  test('slider works with the keyboard', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40')
    const u = ui(page)
    await u.slider.focus()

    await page.keyboard.press('ArrowRight') // one step = 36,000 / 500 = 72 → 1 share
    await expect(u.shares).toHaveText('1')
    await expect(u.capitalDisplay).toHaveText('$40.00')
    await expect(u.newAvg).toHaveText('$49.90')

    await page.keyboard.press('End')
    await expect(u.capitalDisplay).toHaveText('$36,000.00')
    await expect(u.newAvg).toHaveText('$41.00')
    await expect(u.delta).toHaveText('$9.00')
    await expect(u.deltaSub).toHaveText('90% of max')
    await expect(u.capitalPct).toHaveText('90% of max improvement')
    await expect(u.slider).toHaveAttribute('aria-valuetext', /new average \$41\.00/)

    await page.keyboard.press('Home')
    await expect(u.newAvg).toHaveText('—')
    await expect(u.cursor).toHaveAttribute('visibility', 'hidden')
  })

  test('exact amount field drives the same result and explains leftovers', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40')
    const u = ui(page)
    await u.amount.fill('350')
    await expect(u.shares).toHaveText('8')
    await expect(u.capital).toHaveText('$320')
    await expect(u.capitalSub).toHaveText('for 8 shares')
    await expect(u.amountNote).toHaveText('8 whole shares cost $320.00; $30.00 stays uninvested.')
    await expect(u.slider).toHaveValue(/^3\d\d/) // the slider follows (snapped to its step)
  })

  test('the result cards do not move while the slider moves', async ({ page }) => {
    // $25 shares with a $45 slider step: every other step leaves money uninvested.
    for (const width of [page.viewportSize()!.width, 1024, 800, 600]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('./?q0=100&p0=50&pm=25')
      await ui(page).slider.focus()
      const boxes = new Set<string>()
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('ArrowRight')
        boxes.add(
          await page.locator('#stats').evaluate((el) => {
            const rect = el.getBoundingClientRect()
            return `${Math.round(rect.top + window.scrollY)}:${Math.round(rect.height)}`
          }),
        )
      }
      expect([...boxes], `at ${width}px`).toHaveLength(1)
    }
  })

  test('amounts above the slider range are capped with an explanation', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40')
    const u = ui(page)
    await u.amount.fill('50000')
    await expect(u.capitalDisplay).toHaveText('$36,000.00')
    await expect(u.amountNote).toContainText('Capped at $36,000.00')
  })

  test('clicking the chart selects an amount', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40')
    const u = ui(page)
    const hit = page.locator('#chart .hit-area')
    await hit.scrollIntoViewIfNeeded()
    const box = (await hit.boundingBox())!
    await hit.click({ position: { x: box.width / 2, y: box.height / 2 } })

    await expect(u.cursor).toHaveAttribute('visibility', 'visible')
    // Half of the range (18,000), snapped to the 72-dollar slider step.
    const capital = money(await u.amount.inputValue())
    expect(Math.abs(capital - 18_000)).toBeLessThanOrEqual(72 * 4)
    expect(capital % 72).toBe(0)
    await expect(u.shares).toHaveText(String(Math.floor(capital / 40)))
  })
})

test.describe('results stay in sync', () => {
  test('chart marker, stats, table and description show the same numbers', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=4000')
    const u = ui(page)

    await expect(u.newAvg).toHaveText('$45.00')
    await expect(u.newAvgSub).toHaveText('was $50.00')
    await expect(u.delta).toHaveText('$5.00')
    await expect(u.deltaSub).toHaveText('50% of max')
    await expect(u.capital).toHaveText('$4,000')
    await expect(u.shares).toHaveText('100')
    await expect(u.efficiency).toHaveText('0.1250%')
    await expect(u.tooltip).toHaveText(await u.newAvg.innerText())
    await expect(page.locator('#chart desc')).toContainText('new average $45.00')

    const shares = money(await u.shares.innerText())
    expect(shares * 40).toBe(money(await u.capital.innerText()))

    await page.getByText('Show the curve as a table').click()
    const rows = page.locator('#data-table-body tr')
    await expect(rows).toHaveCount(6)
    await expect(rows.last().locator('td')).toHaveText(['$36,000', '900', '$36,000', '$41.00', '$9.00', '90%'])
  })

  test('the marker moves to the selected point on the curve', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=4000')
    const ring = page.locator('#chart .cursor-ring')
    const before = Number(await ring.getAttribute('cx'))
    await ui(page).amount.fill('20000')
    await expect(ring).not.toHaveAttribute('cx', String(before.toFixed(2)))
    expect(Number(await ring.getAttribute('cx'))).toBeGreaterThan(before)
  })
})

test.describe('special cases', () => {
  test('averaging up shows a warning with the real market price', async ({ page }) => {
    await page.goto('./?q0=100&p0=40&pm=50&c=5000')
    const u = ui(page)
    const notice = page.locator('#notice-averaging-up')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText('The current price ($50.00) is above your average buy price ($40.00)')
    await expect(u.newAvg).toHaveText('$45.00')
    await expect(u.newAvgSub).toHaveText('up from $40.00')
    await expect(u.delta).toHaveText('—')
    await expect(page.locator('#chart .asymptote-label')).toHaveText('limit -$10.00')
    await expect(page.locator('#slider-mid')).toHaveText("10× your position's cost")
  })

  test('equal prices explain that nothing can change', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=50&c=1000')
    await expect(page.locator('#notice-flat')).toBeVisible()
    await expect(ui(page).newAvg).toHaveText('$50.00')
    await expect(ui(page).delta).toHaveText('—')
  })

  test('penny stocks show enough decimals', async ({ page }) => {
    await page.goto('./?q0=25000&p0=0.0125&pm=0.0089&c=900')
    await expect(ui(page).newAvg).toHaveText('$0.009614')
    await expect(ui(page).shares).toHaveText('101,123')
  })
})

test.describe('example, reset and shareable links', () => {
  test('the example button loads a position and the URL follows', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('button', { name: 'Try an example' }).click()
    const u = ui(page)
    await expect(u.q0).toHaveValue('100')
    await expect(u.newAvg).toHaveText('$45.00')
    await expect(page).toHaveURL(/\?q0=100&p0=50&pm=40&c=4000$/)
  })

  test('reset clears everything and returns focus to the first field', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=4000')
    await page.getByRole('button', { name: 'Reset' }).click()
    const u = ui(page)
    await expect(u.q0).toHaveValue('')
    await expect(u.q0).toBeFocused()
    await expect(u.capitalPanel).toBeHidden()
    await expect(page).toHaveURL(test.info().project.use.baseURL!)
  })

  test('a shared link restores the scenario', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=12000')
    const u = ui(page)
    await expect(u.newAvg).toHaveText('$42.50')
    await expect(u.delta).toHaveText('$7.50')
    await expect(u.deltaSub).toHaveText('75% of max')
  })

  test('invalid values in a link are explained', async ({ page }) => {
    await page.goto('./?q0=ten&p0=50&pm=40')
    await expect(page.locator('#q0-error')).toBeVisible()
  })
})

test.describe('theme', () => {
  test('the theme toggle switches and remembers the choice', async ({ page }) => {
    await page.goto('./')
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'light')
    await page.getByRole('button', { name: 'Switch to dark theme' }).click()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'dark')
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible()
  })

  test('follows the system preference when nothing is saved', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' })
    const page = await context.newPage()
    await page.goto(test.info().project.use.baseURL!)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await context.close()
  })
})
