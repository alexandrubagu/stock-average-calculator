# Stock Average Calculator

A static, privacy-friendly stock average (averaging down) calculator. Enter the shares you hold, your average buy price
and the current price to see:

- your new average cost
- how many whole shares a given amount buys
- how much of the maximum possible improvement you reach
- an interactive curve showing why every extra dollar improves your average by less than the one before

It is a standalone rebuild of the `/stock-average-calculator` LiveView page of the original Elixir/Phoenix app. The
formulas and display rules are the same, verified value-for-value against the original. It runs entirely in the browser
and is hosted on GitHub Pages.

**Production URL:** <https://alexandrubagu.github.io/stock-average-calculator/>
(configurable — see [Base URL](#base-url-and-custom-domains)).

> Not financial advice. The calculator performs mathematical calculations only.

## Features

- **Live calculation** of new average, improvement, % of maximum, amount spent, whole shares and marginal efficiency,
  using 28-digit decimal arithmetic (`decimal.js`, configured like Elixir's `Decimal`).
- **Diminishing-returns curve.** Custom SVG with:
  - a monotone cubic (Fritsch–Carlson) curve and area fill
  - the dashed maximum-improvement asymptote
  - a cursor with a tooltip

  It is rendered at the container's real pixel width, so labels stay readable on phones.
- **Capital controls**:
  - the original slider (0 → capital that reaches 90% of the maximum improvement)
  - an exact amount field
  - click or drag on the chart
- **Clear states.** Validation runs on blur with actionable messages, plus an averaging-up warning, an equal-price
  notice, and a placeholder chart.
- **Guided tour.** On the first visit, a short tour types an example position into the three fields, moves the
  slider and points at each result, then clears the example. **How it works** replays it at any time.
  - It doesn't start by itself when the page is opened from a shared link, and once it has been finished or
    skipped it never starts on its own again (remembered in `localStorage` as `tour-seen`).
  - It works with the keyboard (Esc closes it, and the page behind it is inert) and is read aloud step by step
    by screen readers.
  - With reduced motion turned on, values appear instantly instead of being typed and slid.
- **Extras:**
  - "Reset"
  - a shareable URL (`?q0=100&p0=50&pm=40&c=4000`)
  - an accessible data table
  - screen-reader announcements
  - light/dark theme that follows the OS
- **Static explanatory content** for search engines and readers: how averaging down works, the formulas, a verified
  worked example and a FAQ. This content doesn't depend on JavaScript.
- **No backend, no cookies, no analytics, no third-party requests.**

## Technology choices

| Concern | Choice | Why |
| --- | --- | --- |
| Build | [Vite 8](https://vite.dev) | Fast dev server; hashed, minified static output; multi-page (index + 404) |
| Language | TypeScript (strict), vanilla DOM | One interactive widget doesn't justify a UI framework; ~21 KB gzipped JS in total |
| Math | `decimal.js` (only runtime dependency) | Same precision/rounding as the original `Decimal` code, no float errors |
| Chart | Hand-written SVG | Direct port of the original `curve.ex`; no chart library needed |
| Styles | Plain CSS with custom-property design tokens | Small, themeable (light/dark), no build plugin |
| Tests | Vitest (unit), Playwright + axe-core (e2e, a11y) | Fast logic tests plus real-browser checks of the production build |

## Project structure

```
index.html                 Calculator page (all content is static HTML; JS enhances it)
404.html                   Not-found page for GitHub Pages
public/                    favicon.svg, og-image.png, apple-touch-icon.png (copied as-is)
site.config.ts             Production URL (SITE_URL) → canonical URL and Vite base path
vite.config.ts             Build config + plugin that injects SITE_URL and emits robots.txt / sitemap.xml
src/
  lib/decimal.ts           Decimal configured like Elixir's default context (28 digits, half up)
  lib/calculator.ts        All financial math (port of Avgr.Calculator)
  lib/validation.ts        Input parsing and validation messages
  lib/chart-geometry.ts    Scales, Fritsch–Carlson path, ticks (port of AvgrWeb.Components.Curve)
  lib/format.ts            Currency, axis-label and percentage formatting
  state/store.ts           Pure state transitions (mirrors the LiveView event handlers)
  ui/                      DOM rendering only: form, chart, capital controls, results, theme, URL state, tour
  styles/main.css          Design tokens, layout and components
tests/
  unit/                    Vitest: calculator, validation, chart geometry, formatting, store
  e2e/                     Playwright: behaviour, sync, layout, accessibility (axe), SEO output
  fixtures/elixir-reference.json   Values exported from the original Elixir implementation
scripts/
  export-elixir-reference.exs   Regenerates the reference fixture from the Phoenix sources
  verify-dist.mjs               Checks the production build before deployment
  render-og-image.mjs           Renders public/og-image.png and apple-touch-icon.png
.github/workflows/deploy.yml    Test, build, verify and deploy to GitHub Pages
```

## Getting started

Requirements: Node.js 22.18 or newer (see `.nvmrc` / `.tool-versions`) and npm.

```bash
npm ci
npm run dev        # http://localhost:5173/stock-average-calculator/
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then build the optimized site into `dist/` |
| `npm run preview` | Serve `dist/` at http://localhost:4173/stock-average-calculator/ |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) against the built site — run `npm run build` first |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run verify` | Verify `dist/`: files, links, metadata, sitemap, no dev/Phoenix leftovers |
| `npm run og-image` | Re-render the social image and touch icon |
| `npm run check` | Everything: lint, unit tests, build, verify, e2e |

## Testing

```bash
npm test                              # unit tests
npx playwright install chromium       # once, downloads the test browser
npm run build && npm run test:e2e     # end-to-end tests on the production build
```

- **Unit tests:**
  - every formula and the original ExUnit cases
  - decimal edge cases (e.g. 0.3 ÷ 0.1 buys exactly 3 shares)
  - boundaries and invalid input
  - the worked-example numbers shown on the page
  - sequential purchases
  - chart geometry and formatting
- **Regression against the original.** `tests/fixtures/elixir-reference.json` holds the output of the original
  `Avgr.Calculator` and `Curve` modules for 12 scenarios: all 121 curve points, simulation results at 9 amounts, chart
  paths and ticks. The tests require the TypeScript results to be identical: currently 7,795 of 7,795 values match bit
  for bit. To regenerate the fixture from a Phoenix checkout:

  ```bash
  AVGR=../avgr.app
  elixir -pa $AVGR/_build/dev/lib/decimal/ebin -pa $AVGR/_build/dev/lib/jason/ebin \
    scripts/export-elixir-reference.exs $AVGR > tests/fixtures/elixir-reference.json
  ```

- **End-to-end tests** run on desktop and mobile (Pixel 7) profiles. They cover:
  - defaults
  - editing each input
  - validation timing
  - slider keyboard control
  - typed amounts and chart clicks
  - chart/stat/table synchronization
  - the guided tour (first visit, replay, Back/Next mid-animation, Esc, layout on desktop and mobile)
  - reset and shared links
  - special cases
  - theme persistence
  - no horizontal scrolling from 320 px to 1920 px
  - tab order and the skip link
  - axe-core WCAG 2.2 AA scans (light/dark, empty/filled/error states)
  - robots.txt, sitemap.xml and the 404 page
  - no requests outside the site
  - no console errors

## Production build

`npm run build` writes `dist/`:

- `index.html` and `404.html`, with `SITE_URL` injected into the canonical, Open Graph and JSON-LD URLs
- `assets/*-[hash].js|css`: minified (Oxc for JS, Lightning CSS for CSS) and tree-shaken, with cache-friendly hashed
  names
- `robots.txt` and `sitemap.xml`, generated for `SITE_URL`
- the files from `public/`

The build is reproducible: the sitemap's `<lastmod>` is the date of the last git commit, not the build time. It is
omitted when there is no git history.

### Minification and obfuscation

Production JavaScript is **minified but not obfuscated**. Obfuscation was measured by running the
`javascript-obfuscator` CLI over the files in `dist/assets` after `vite build`, with two of its presets. The test used
the median of 15 loads in headless Chromium with 4× CPU throttling; the obfuscated builds worked correctly:

| Variant | JS gzip | JS brotli | Script time | DOMContentLoaded | 200 slider updates |
| --- | --- | --- | --- | --- | --- |
| Minified (shipped) | 21.1 KB | 18.5 KB | 139 ms | 324 ms | 164 ms |
| Obfuscated, low preset | 39.9 KB | 34.6 KB | 154 ms | 348 ms | 177 ms |
| Obfuscated, medium preset | 190.8 KB | 160.8 KB | 562 ms | 756 ms | 559 ms |

Obfuscation only raises the effort needed to read browser-delivered code; it can't keep it secret. This repository's
source is public anyway, and the client code contains no secrets. So obfuscation would add 2–9× download size and up to
4× CPU cost for no protection. If it is ever required, add the same step to the build: run `javascript-obfuscator` on
`dist/assets/*.js` after `vite build` (the low preset is the cheapest). Then run `npm run verify` and
`npm run test:e2e`, which exercise the obfuscated bundle like any other. Source files stay readable, and `npm run dev`
is unaffected.

## Deploying to GitHub Pages

The workflow `.github/workflows/deploy.yml` runs on every push to `main` and on pull requests. Steps:

1. Check out, install Node from `.nvmrc`, and run `npm ci`.
2. Read the Pages URL with `actions/configure-pages`. This step is skipped on pull requests, which use the default URL.
3. Lint, type-check and run the unit tests.
4. Build with `SITE_URL` set to the Pages URL.
5. Verify `dist/` with `npm run verify`.
6. Run the Playwright e2e tests against the built site.
7. On `main` only, upload `dist/` and deploy it with `actions/deploy-pages`.

One-time setup:

1. Create the repository and push it:
   ```bash
   gh repo create alexandrubagu/stock-average-calculator --public --source . --push
   ```
   or create it on github.com and `git push -u origin main`.
2. In the repository, open **Settings → Pages**, and under **Build and deployment → Source** choose **GitHub Actions**.
3. Push to `main`, or run the workflow manually from the **Actions** tab. The site appears at
   `https://<user>.github.io/stock-average-calculator/`.

No secrets are needed. The workflow uses the built-in `GITHUB_TOKEN` with `pages: write` and `id-token: write`.

## Base URL and custom domains

All absolute URLs come from one setting, `SITE_URL`. The default is in `site.config.ts`:

```bash
SITE_URL=https://example.com/ npm run build   # served from the domain root
SITE_URL=https://user.github.io/my-fork/ npm run build
```

Its path becomes Vite's `base`, so asset URLs, the 404 page, the canonical URL, Open Graph tags, `robots.txt` and
`sitemap.xml` all match. In CI, `SITE_URL` comes from `actions/configure-pages`, so a fork or a renamed repository
works without code changes.

**Custom domain later:**

1. In **Settings → Pages → Custom domain**, enter the domain.
2. Create the DNS records GitHub shows: a `CNAME` to `<user>.github.io` for a subdomain, or `A`/`AAAA` records for an
   apex domain.
3. Enable **Enforce HTTPS**.
4. Re-run the workflow. `configure-pages` then reports the new URL, and the site is rebuilt for the domain root.

Also update `DEFAULT_SITE_URL` in `site.config.ts` so local builds match. No `CNAME` file is needed with Actions-based
deployments.

## SEO

- A unique title and meta description; canonical URL; Open Graph and Twitter card tags with a 1200×630 image.
- JSON-LD `WebApplication` and `FAQPage`. The FAQ data is tested to match the visible questions.
- Semantic landmarks and a single `h1`. Static, indexable explanations, formulas, a worked example (its numbers are
  asserted in the unit tests) and a FAQ.
- `robots.txt` and a single-URL `sitemap.xml`, generated for `SITE_URL`. The 404 page is `noindex`.
- **Project-site caveat:** crawlers only read `robots.txt` at the root of a host. Under
  `https://alexandrubagu.github.io/stock-average-calculator/` the generated `robots.txt` is valid but ignored. To make
  the sitemap discoverable, either:
  - add `Sitemap: https://alexandrubagu.github.io/stock-average-calculator/sitemap.xml` to the `robots.txt` of the
    `alexandrubagu.github.io` repository, or
  - submit the sitemap in Google Search Console.

  With a custom domain this caveat goes away.

## Behaviour compared with the original

The formulas, the 121-point curve, the 90% slider bound, whole-share flooring, efficiency, validation timing (errors
after blur) and the stat-card rules are unchanged. These differences are deliberate:

1. **Averaging-up warning shows the real market price.** The original printed `delta_max + new_average` (2·P₀ − Pₘ at
   $0, changing with the slider; e.g. "$30.29" instead of "$50.00").
2. **Values while dragging are exact.** The original browser hook interpolated a 121-point lookup table while dragging,
   then replaced the values when the server answered. For example, at $360 it showed 8 shares / $49.26 during the drag
   and 9 shares / $49.17 after release. Here every update uses the server's exact computation.
3. **Consistent number formatting.** Values use en-US currency with thousands separators and fixed decimals; the
   original mixed `$49.5` and `$49.50`.
   - Prices under $1 show about three significant digits, so penny-stock values don't collapse to `$0.0`.
   - The Capital card keeps whole dollars from $100 up and shows cents below that.
   - At an exact half cent (e.g. $740.925), amounts round half up from the exact decimal value. The original rounded
     the binary float, giving one cent less in 3 of 701 values compared side by side with the running Phoenix app.
4. **Axis labels:**
   - Y-axis decimals follow the tick spacing, so small ranges don't repeat labels like `$0.0`, and overlapping labels
     are skipped.
   - Capital labels roll over to the next unit (`$1.0M`, not `$1000k`), use `B` for billions (not `$2.5e3M`), and keep
     decimals below $10.
5. **Inputs:**
   - Surrounding spaces are ignored, and `.5` and `50.` are accepted.
   - Values are capped at 1,000,000,000,000 shares and $1,000,000,000 per share, which keeps every result finite and
     every share count exact.
   - Error messages explain how to fix the input.
6. **When no improvement is possible** (Pₘ ≥ P₀):
   - The slider caption reads "raises your average" instead of "0% of max improvement".
   - The scale reads "10× your position's cost" instead of "90% of max".
   - When Pₘ = P₀, a notice explains that the average can't change. The original computed `is_averaging_flat` but never
     showed it.
7. **Always visible:** the page heading and the "How to read this chart" card. The original hid the heading once a
   curve existed and showed the card only with a curve.
8. **Guided tour instead of an example button.** The tour and the "How it works" button are new; the original had
   neither. The header link to the explanations below is called "Guide" so it doesn't clash with the button.
9. **Defaults:**
   - The theme follows the operating system until toggled; the original always started light.
   - Links to other avgr.app pages and the analytics script were removed.
10. **Not ported:** the original ExUnit case "compute_efficiency with zero capital returns 0" exercises a guard that a
   Decimal argument never matches. The app always used the general formula, so efficiency at $0 is non-zero in both
   versions.

## Known limitations

- The calculator models one existing position plus one purchase at the current price, in whole shares, without fees
  or taxes, exactly like the original. The fee parameter exists in `calculator.ts` but has no UI, as in the original.
- Results are converted to JavaScript numbers (IEEE doubles) for display after the decimal computation, as the
  original converted to floats.
- The interactive calculator needs JavaScript; the explanatory content and formulas don't.
- The footer links to `https://github.com/alexandrubagu/stock-average-calculator`; update it if the repository lives
  elsewhere.
- No license file is included yet. Choose one before publishing if you want others to reuse the code.
