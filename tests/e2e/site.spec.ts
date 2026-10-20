import { resolveSiteConfig } from '../../site.config.ts'
import { expect, test } from './fixtures'

const site = resolveSiteConfig()

test.describe('static site output', () => {
  test('head metadata uses the production URL', async ({ page }) => {
    await page.goto('./')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', site.url)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', site.url)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${site.url}og-image.png`)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /stock average calculator/i)

    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents()
    const parsed = jsonLd.map((text) => JSON.parse(text))
    expect(parsed.map((entry) => entry['@type'])).toEqual(['WebApplication', 'FAQPage'])
    expect(parsed[0].url).toBe(site.url)
  })

  test('the FAQ structured data matches the visible questions', async ({ page }) => {
    await page.goto('./')
    const jsonLd = JSON.parse((await page.locator('script[type="application/ld+json"]').nth(1).textContent())!)
    const questions = jsonLd.mainEntity.map((q: { name: string }) => q.name)
    await expect(page.locator('#faq h3')).toHaveText(questions)
  })

  test('robots.txt points to the sitemap', async ({ request }) => {
    const response = await request.get('robots.txt')
    expect(response.ok()).toBe(true)
    const text = await response.text()
    expect(text).toContain('User-agent: *')
    expect(text).toContain(`Sitemap: ${site.url}sitemap.xml`)
  })

  test('sitemap.xml lists the canonical URL', async ({ request }) => {
    const response = await request.get('sitemap.xml')
    expect(response.ok()).toBe(true)
    const xml = await response.text()
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain(`<loc>${site.url}</loc>`)
  })

  test('the 404 page loads its styles and links back to the calculator', async ({ page }) => {
    await page.goto('404.html')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(background).not.toBe('rgba(0, 0, 0, 0)')
    await page.getByRole('link', { name: 'Open the stock average calculator' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stock Average Calculator')
  })

  test('every asset referenced by the page loads', async ({ page }) => {
    const failures: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
    })
    await page.goto('./')
    const icons = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((links) =>
      links.map((link) => (link as HTMLLinkElement).href),
    )
    for (const href of icons) {
      const response = await page.request.get(href)
      if (!response.ok()) failures.push(`${response.status()} ${href}`)
    }
    expect(failures).toEqual([])
  })

  test('the page makes no requests outside the site', async ({ page }) => {
    const external: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.hostname !== 'localhost') external.push(request.url())
    })
    await page.goto('./?q0=100&p0=50&pm=40&c=4000')
    await page.getByLabel('Amount', { exact: true }).fill('9000')
    expect(external).toEqual([])
  })
})
