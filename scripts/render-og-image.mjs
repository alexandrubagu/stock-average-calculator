// Renders the social sharing image (public/og-image.png, 1200×630) and the
// Apple touch icon (public/apple-touch-icon.png, 180×180) with Playwright.
// The outputs are committed; rerun `npm run og-image` after design changes.
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

// The worked example from the page: 100 shares at $50, price $40.
const q0 = 100
const p0 = 50
const pm = 40
const deltaMax = p0 - pm
const sliderMax = 9 * q0 * pm
const delta = (capital) => p0 - (q0 * p0 + capital) / (q0 + capital / pm)

const plot = { x: 70, y: 40, w: 980, h: 300 }
const px = (capital) => plot.x + (capital / sliderMax) * plot.w
const py = (d) => plot.y + (1 - d / deltaMax) * plot.h
const points = Array.from({ length: 121 }, (_, i) => {
  const capital = (i / 120) * sliderMax
  return `${px(capital).toFixed(1)},${py(delta(capital)).toFixed(1)}`
})
const line = `M ${points.join(' L ')}`
const area = `${line} L ${px(sliderMax)},${py(0)} L ${px(0)},${py(0)} Z`
const marker = { x: px(4000), y: py(delta(4000)) }

const ogHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
         background: #f8fafc; color: #0f172a; padding: 64px 72px; display: flex; flex-direction: column; gap: 28px; }
  .brand { display: flex; align-items: center; gap: 16px; font-size: 30px; font-weight: 700; letter-spacing: -0.01em; }
  h1 { font-size: 50px; line-height: 1.12; letter-spacing: -0.025em; }
  h1 span { color: #2563eb; }
  .card { flex: 1; min-height: 0; background: #fff; border: 2px solid #e2e8f0; border-radius: 24px; padding: 8px 24px; }
</style></head>
<body>
  <div class="brand">${mark(48)}Stock Average Calculator</div>
  <h1>See how much averaging down <span>really</span> lowers your cost basis</h1>
  <div class="card">
    <svg viewBox="0 0 1100 360" width="100%" height="100%">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#2563eb" stop-opacity=".22"/><stop offset="1" stop-color="#2563eb" stop-opacity=".02"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#g)"/>
      <line x1="${plot.x}" y1="${py(deltaMax)}" x2="${plot.x + plot.w}" y2="${py(deltaMax)}" stroke="#dc2626" stroke-width="3" stroke-dasharray="12 8"/>
      <text x="${plot.x + plot.w}" y="${py(deltaMax) - 12}" text-anchor="end" font-size="22" font-weight="700" fill="#b91c1c">max improvement</text>
      <line x1="${plot.x}" y1="${py(0)}" x2="${plot.x + plot.w}" y2="${py(0)}" stroke="#cbd5e1" stroke-width="2"/>
      <path d="${line}" fill="none" stroke="#2563eb" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${marker.x}" cy="${marker.y}" r="13" fill="#fff" stroke="#2563eb" stroke-width="6"/>
      <rect x="${marker.x + 22}" y="${marker.y + 6}" width="210" height="44" rx="10" fill="#0f172a"/>
      <text x="${marker.x + 127}" y="${marker.y + 36}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff">new avg $45.00</text>
    </svg>
  </div>
</body></html>`

const iconHtml = `<!doctype html><html><head><style>*{margin:0}body{width:180px;height:180px}</style></head>
<body>${mark(180, 0)}</body></html>`

function mark(size, radius = 8) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="${radius}" fill="#2563eb"/>
    <path d="M7 24c3-10 8-14 18-15" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M7 8h18" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="2.5 2.5" opacity=".75"/></svg>`
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await page.setContent(ogHtml)
  await page.screenshot({ path: `${publicDir}og-image.png` })

  await page.setViewportSize({ width: 180, height: 180 })
  await page.setContent(iconHtml)
  await page.screenshot({ path: `${publicDir}apple-touch-icon.png` })
} finally {
  await browser.close()
}
console.log('Wrote public/og-image.png and public/apple-touch-icon.png')
