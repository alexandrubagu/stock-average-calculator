import { resolveSiteConfig } from '../../site.config.ts'
import { expect, test } from './fixtures'

const site = resolveSiteConfig()
const calculatorUrl = `${site.url}calculator/`
const PLAY_URL = 'https://play.google.com/store/apps/details?id=io.github.alexandrubagu.stockaverage'

test.describe('landing page', () => {
  test('head metadata describes the Android app', async ({ page }) => {
    await page.goto('./')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', site.url)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', site.url)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${site.url}og-app.png`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /stock average calculator/i)

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    const parsed = jsonLd.map((text) => JSON.parse(text))
    expect(parsed.map((entry) => entry['@type'])).toEqual(['MobileApplication'])
    expect(parsed[0].url).toBe(site.url)
    expect(parsed[0].operatingSystem).toBe('Android')
    expect(parsed[0].installUrl).toBe(PLAY_URL)
  })

  test('every Google Play link points to the app listing', async ({ page }) => {
    await page.goto('./')
    const badges = page.getByRole('link', { name: 'Get it on Google Play' })
    await expect(badges).toHaveCount(2)
    for (const link of await page.locator('a[href*="play.google.com"]').all()) {
      await expect(link).toHaveAttribute('href', PLAY_URL)
    }
  })

  test('the carousel moves between screenshots', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('./')
    const dots = page.locator('.dots button')
    await expect(dots).toHaveCount(5)
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
    await page.getByRole('button', { name: 'Next screenshot' }).click()
    await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true')
    await dots.nth(4).click()
    await expect(dots.nth(4)).toHaveAttribute('aria-current', 'true')
    await page.getByRole('button', { name: 'Next screenshot' }).click()
    await expect(dots.nth(0)).toHaveAttribute('aria-current', 'true')
  })

  test('links to the web calculator', async ({ page }) => {
    await page.goto('./')
    await page.getByRole('link', { name: 'Use the web calculator' }).click()
    await expect(page).toHaveURL(/\/calculator\/$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stock Average Calculator')
  })

  test('old calculator links redirect to the calculator', async ({ page }) => {
    await page.goto('./?q0=100&p0=50&pm=40&c=4000')
    await expect(page).toHaveURL(/\/calculator\/\?q0=100&p0=50&pm=40&c=4000$/)
    await expect(page.getByRole('textbox', { name: 'Shares held' })).toHaveValue('100')

    await page.goto('./#faq')
    await expect(page).toHaveURL(/\/calculator\/#faq$/)
  })

  test('the page makes no requests outside the site', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).hostname !== 'localhost') external.push(request.url())
    })
    await page.goto('./')
    await page.getByRole('button', { name: 'Next screenshot' }).click()
    expect(external).toEqual([])
  })
})

test.describe('web calculator page', () => {
  test('head metadata uses its own canonical URL', async ({ page }) => {
    await page.goto('calculator/')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', calculatorUrl)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', calculatorUrl)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${site.url}og-image.png`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /stock average calculator/i)

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    const parsed = jsonLd.map((text) => JSON.parse(text))
    expect(parsed.map((entry) => entry['@type'])).toEqual(['WebApplication', 'FAQPage'])
    expect(parsed[0].url).toBe(calculatorUrl)
  })

  test('the FAQ structured data matches the visible questions', async ({ page }) => {
    await page.goto('calculator/')
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').nth(1).textContent())!)
    const questions = jsonLd.mainEntity.map((q: { name: string }) => q.name)
    await expect(page.locator('#faq h3')).toHaveText(questions)
  })

  test('links to the Android app', async ({ page }) => {
    await page.goto('calculator/')
    await page.getByRole('link', { name: 'Get the Android app' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('See what averaging down really does')
  })

  test('the page makes no requests outside the site', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).hostname !== 'localhost') external.push(request.url())
    })
    await page.goto('calculator/?q0=100&p0=50&pm=40&c=4000')
    await page.getByLabel('Amount', { exact: true }).fill('9000')
    expect(external).toEqual([])
  })
})

test.describe('static site output', () => {
  test('robots.txt points to the sitemap', async ({ request }) => {
    const response = await request.get('robots.txt')
    expect(response.ok()).toBe(true)
    const text = await response.text()
    expect(text).toContain('User-agent: *')
    expect(text).toContain(`Sitemap: ${site.url}sitemap.xml`)
  })

  test('sitemap.xml lists the landing page and the calculator', async ({ request }) => {
    const response = await request.get('sitemap.xml')
    expect(response.ok()).toBe(true)
    const xml = await response.text()
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain(`<loc>${site.url}</loc>`)
    expect(xml).toContain(`<loc>${calculatorUrl}</loc>`)
  })

  test('the 404 page loads its styles and links to the calculator', async ({ page }) => {
    await page.goto('404.html')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    await page.getByRole('link', { name: 'Open the stock average calculator' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stock Average Calculator')
  })

  for (const path of ['./', 'calculator/']) {
    test(`every asset referenced by ${path} loads`, async ({ page }) => {
      const failures: string[] = []
      page.on('response', (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
      })
      await page.goto(path)
      const refs = await page
        .locator('link[rel="icon"], link[rel="apple-touch-icon"], img')
        .evaluateAll((nodes) => nodes.map((node) => (node as HTMLLinkElement).href || (node as HTMLImageElement).src))
      for (const href of refs) {
        const response = await page.request.get(href)
        if (!response.ok()) failures.push(`${response.status()} ${href}`)
      }
      expect(failures).toEqual([])
    })
  }
})
