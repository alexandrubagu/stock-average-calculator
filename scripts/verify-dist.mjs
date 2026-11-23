// Verifies the production build in dist/ before it is deployed:
//   - required files exist
//   - every local href/src in the HTML resolves to a file in dist/
//   - canonical, og:url and sitemap <loc> use SITE_URL; robots.txt points to the sitemap
//   - nothing references a development server or the original Phoenix app
// Usage: SITE_URL=... node scripts/verify-dist.mjs   (same SITE_URL as the build)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveSiteConfig } from '../site.config.ts'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const site = resolveSiteConfig()
const siteUrl = new URL(site.url)
const basePath = site.basePath

const problems = []
const fail = (message) => problems.push(message)

const files = walk(dist).map((file) => relative(dist, file).split('\\').join('/'))

const requiredFiles = [
  'index.html',
  'calculator/index.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'favicon.svg',
  'og-image.png',
  'og-app.png',
  'apple-touch-icon.png',
  'app/google-play-badge.png',
  'app/icon-192.png',
]
for (const required of requiredFiles) {
  if (!files.includes(required)) fail(`missing dist/${required}`)
}
if (!files.some((file) => /^assets\/.+-[\w-]{8}\.js$/.test(file))) fail('no hashed JavaScript bundle in dist/assets')
if (!files.some((file) => /^assets\/.+-[\w-]{8}\.css$/.test(file))) fail('no hashed CSS bundle in dist/assets')

// Local references in the HTML pages
for (const page of files.filter((file) => file.endsWith('.html'))) {
  const html = readFileSync(join(dist, page), 'utf8')
  for (const [, ref] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    if (/^(#|mailto:|data:)/.test(ref) || /^https?:\/\//.test(ref) && !ref.startsWith(siteUrl.href)) continue
    let path
    if (ref.startsWith(siteUrl.href)) path = ref.slice(siteUrl.href.length)
    else if (ref.startsWith(basePath)) path = ref.slice(basePath.length)
    else if (ref.startsWith('/')) {
      fail(`${page}: "${ref}" is outside the base path ${basePath}`)
      continue
    } else path = ref.replace(/^\.\//, '')
    path = path.split(/[?#]/)[0]
    const target = path === '' || path.endsWith('/') ? `${path}index.html` : path
    if (!files.includes(target)) fail(`${page}: "${ref}" does not resolve to a file in dist/`)
  }
}

// SEO metadata of the indexable pages: the landing page and the web calculator
const pages = [
  { file: 'index.html', url: siteUrl.href, ogImage: `${siteUrl.href}og-app.png` },
  { file: 'calculator/index.html', url: `${siteUrl.href}calculator/`, ogImage: `${siteUrl.href}og-image.png` },
]
for (const { file, url, ogImage } of pages) {
  const html = readFileSync(join(dist, file), 'utf8')
  const attr = (pattern) => html.match(pattern)?.[1]
  if (attr(/<link rel="canonical" href="([^"]+)"/) !== url) fail(`${file}: canonical URL is not ${url}`)
  if (attr(/<meta property="og:url" content="([^"]+)"/) !== url) fail(`${file}: og:url is not ${url}`)
  if (attr(/<meta property="og:image" content="([^"]+)"/) !== ogImage) fail(`${file}: og:image is not ${ogImage}`)
  if (!/<title>[^<]{10,70}<\/title>/.test(html)) fail(`${file}: missing or overly long <title>`)
  if (!/<meta\s+name="description"\s+content="[^"]{50,170}"/.test(html)) fail(`${file}: missing or overly long meta description`)
  if (html.includes('%SITE_URL%') || html.includes('%BASE_URL%')) fail(`${file}: unreplaced placeholder`)
  for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(json)
    } catch {
      fail(`${file}: invalid JSON-LD block`)
    }
  }
}

const robots = readFileSync(join(dist, 'robots.txt'), 'utf8')
if (!robots.includes(`Sitemap: ${siteUrl.href}sitemap.xml`)) fail('robots.txt does not reference the sitemap')

const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8')
if (!sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) fail('sitemap.xml has no XML declaration')
if (!sitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')) fail('sitemap.xml has no urlset')
for (const { url } of pages) if (!sitemap.includes(`<loc>${url}</loc>`)) fail(`sitemap.xml does not list ${url}`)
if ((sitemap.match(/<url>/g) ?? []).length !== (sitemap.match(/<\/url>/g) ?? []).length) fail('sitemap.xml is not well-formed')

// No development or Phoenix leftovers in any text file
const forbidden = [/localhost/i, /127\.0\.0\.1/, /phx-/, /phoenix/i, /liveSocket/, /avgr\.app/i, /\/live\b/]
for (const file of files.filter((f) => /\.(html|js|css|txt|xml|svg)$/.test(f))) {
  const text = readFileSync(join(dist, file), 'utf8')
  for (const pattern of forbidden) if (pattern.test(text)) fail(`${file} contains ${pattern}`)
}

if (problems.length) {
  console.error(`dist/ verification failed (${problems.length}):`)
  for (const problem of problems) console.error(`  ✗ ${problem}`)
  process.exit(1)
}
console.log(`dist/ verified for ${siteUrl.href} — ${files.length} files OK`)

function walk(dir) {
  if (!existsSync(dir)) {
    console.error('dist/ not found — run `npm run build` first')
    process.exit(1)
  }
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
