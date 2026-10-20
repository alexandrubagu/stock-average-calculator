/**
 * Production URL configuration.
 *
 * Set SITE_URL to the address the site is served from. The GitHub Actions
 * workflow passes the URL reported by `actions/configure-pages`, so a custom
 * domain configured in the repository settings is picked up automatically.
 * Canonical/Open Graph URLs, robots.txt and sitemap.xml are derived from it,
 * and its path becomes Vite's `base` (e.g. "/stock-average-calculator/").
 */
export const DEFAULT_SITE_URL = 'https://alexandrubagu.github.io/stock-average-calculator/'

export interface SiteConfig {
  /** Absolute URL with a trailing slash, e.g. https://example.github.io/repo/ */
  url: string
  /** Path part used as Vite `base`, e.g. /repo/ */
  basePath: string
}

export function resolveSiteConfig(raw: string | undefined = process.env.SITE_URL): SiteConfig {
  const url = new URL(raw && raw.trim() !== '' ? raw.trim() : DEFAULT_SITE_URL)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`SITE_URL must be an http(s) URL, got "${raw}"`)
  }
  url.search = ''
  url.hash = ''
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return { url: url.href, basePath: url.pathname }
}
