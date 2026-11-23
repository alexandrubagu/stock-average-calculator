/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { resolveSiteConfig, type SiteConfig } from './site.config.ts'

const site = resolveSiteConfig()

export default defineConfig({
  base: site.basePath,
  appType: 'mpa',
  plugins: [sitePlugin(site)],
  build: {
    target: 'es2020',
    sourcemap: false,
    // index.html already preloads the single entry chunk.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        calculator: resolve(import.meta.dirname, 'calculator/index.html'),
        notFound: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})

/**
 * Injects the production URL into the HTML (`%SITE_URL%`) and emits
 * robots.txt and sitemap.xml for that URL (landing page + web calculator).
 */
function sitePlugin(config: SiteConfig): Plugin {
  return {
    name: 'site-metadata',
    transformIndexHtml: {
      // Runs before Vite's own %ENV% replacement, which would warn about it.
      order: 'pre',
      handler: (html) => html.replaceAll('%SITE_URL%', config.url),
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(config) })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(config, lastCommitDate()) })
    },
  }
}

function robotsTxt(config: SiteConfig): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${config.url}sitemap.xml\n`
}

const SITEMAP_PATHS = ['', 'calculator/']

function sitemapXml(config: SiteConfig, lastmod: string | null): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''
  const urls = SITEMAP_PATHS.map((path) => `  <url>\n    <loc>${config.url}${path}</loc>${lastmodTag}\n  </url>`)
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}

/** Date of the last commit (YYYY-MM-DD) so rebuilds of a commit are identical. */
function lastCommitDate(): string | null {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return /^\d{4}-\d{2}-\d{2}$/.test(out.trim()) ? out.trim() : null
  } catch {
    return null
  }
}
