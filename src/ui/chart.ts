/**
 * SVG chart rendering. All geometry comes from lib/chart-geometry and all
 * values from the store, so the chart never computes financial numbers itself.
 *
 * The SVG is rebuilt only when the curve or the container size changes; slider
 * movement just moves the cursor elements.
 */
import {
  DEFAULT_LAYOUT,
  buildAreaPath,
  buildSvgPath,
  capitalAtX,
  makeScales,
  xTicks,
  yTicks,
  type ChartLayout,
  type Scales,
} from '../lib/chart-geometry'
import type { CurvePayload } from '../lib/calculator'
import { formatCapitalTick, formatDeltaTick, formatPrice } from '../lib/format'
import type { State } from '../state/store'
import { describeChart } from './describe'
import { escapeXml, setText } from './dom'

export interface ChartView {
  render(state: State): void
}

interface Drawn {
  curve: CurvePayload
  layout: ChartLayout
  scales: Scales
  cursor: SVGGElement
  cursorLine: SVGLineElement
  cursorRing: SVGCircleElement
  cursorDot: SVGCircleElement
  tooltipBg: SVGRectElement
  tooltipText: SVGTextElement
  desc: SVGDescElement
}

const LABEL_CHAR_WIDTH = 6.6

export function createChart(
  root: HTMLElement,
  onSelectCapital: (capital: number, done: boolean) => void,
): ChartView {
  let width = measure()
  let drawn: Drawn | null = null
  let placeholderKey = ''
  let latest: State | null = null
  let dragging = false

  new ResizeObserver(() => {
    const next = measure()
    if (Math.abs(next - width) >= 1) {
      width = next
      if (latest) render(latest)
    }
  }).observe(root)

  root.addEventListener('pointerdown', (event) => {
    if (!drawn || !(event.target instanceof Element) || !event.target.closest('.hit-area')) return
    dragging = true
    root.setPointerCapture(event.pointerId)
    select(event, false)
  })
  root.addEventListener('pointermove', (event) => {
    if (dragging) select(event, false)
  })
  root.addEventListener('pointerup', (event) => {
    if (!dragging) return
    dragging = false
    select(event, true)
  })
  root.addEventListener('pointercancel', () => {
    dragging = false
  })

  function measure(): number {
    return Math.round(root.clientWidth) || DEFAULT_LAYOUT.width
  }

  function select(event: PointerEvent, done: boolean): void {
    if (!drawn) return
    const svg = root.querySelector('svg')
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const x = ((event.clientX - rect.left) * drawn.layout.width) / rect.width
    onSelectCapital(capitalAtX(x, drawn.curve.sliderMax, drawn.scales), done)
  }

  function render(state: State): void {
    latest = state
    const { curve } = state

    if (!curve || !state.result) {
      const layout = layoutFor(width, [])
      const key = `${layout.width}x${layout.height}`
      if (drawn || placeholderKey !== key) {
        root.innerHTML = placeholderSvg(layout)
        drawn = null
        placeholderKey = key
      }
      return
    }

    const tickCountY = width < 480 ? 4 : DEFAULT_LAYOUT.tickCountY
    const yLabels = yTickLabels(curve, tickCountY)
    const layout = layoutFor(width, yLabels)
    if (!drawn || drawn.curve !== curve || !sameLayout(drawn.layout, layout)) {
      drawn = draw(root, curve, layout)
      placeholderKey = ''
    }

    updateCursor(drawn, state)
    setText(drawn.desc, describeChart(state))
  }

  return { render }
}

function layoutFor(width: number, yLabels: string[]): ChartLayout {
  const w = Math.max(280, Math.round(width))
  const compact = w < 480
  const height = compact ? 250 : Math.round(Math.min(360, Math.max(260, (w * DEFAULT_LAYOUT.height) / DEFAULT_LAYOUT.width)))
  const longest = yLabels.reduce((max, label) => Math.max(max, label.length), 0)
  const minLeft = compact ? 52 : DEFAULT_LAYOUT.margins.left
  return {
    width: w,
    height,
    margins: {
      top: compact ? 24 : DEFAULT_LAYOUT.margins.top,
      right: compact ? 16 : DEFAULT_LAYOUT.margins.right,
      bottom: compact ? 46 : DEFAULT_LAYOUT.margins.bottom,
      left: Math.max(minLeft, Math.ceil(longest * LABEL_CHAR_WIDTH + 30)),
    },
    tickCountX: compact ? 3 : DEFAULT_LAYOUT.tickCountX,
    tickCountY: compact ? 4 : DEFAULT_LAYOUT.tickCountY,
  }
}

function sameLayout(a: ChartLayout, b: ChartLayout): boolean {
  return a.width === b.width && a.height === b.height && a.margins.left === b.margins.left && a.tickCountX === b.tickCountX
}

function yTickLabels(curve: CurvePayload, count: number): string[] {
  const yMin = Math.min(0, curve.deltaMax)
  const yMax = Math.max(0, curve.deltaMax)
  const step = (yMax - yMin) / count
  const labels: string[] = []
  for (let i = 0; i <= count; i++) labels.push(formatDeltaTick(yMin + (i / count) * (yMax - yMin), step))
  return labels
}

function draw(root: HTMLElement, curve: CurvePayload, layout: ChartLayout): Drawn {
  const scales = makeScales(curve.sliderMax, curve.deltaMax, layout)
  const { margins: m, width: w, height: h } = layout
  const right = w - m.right
  const bottom = h - m.bottom
  const plotMidY = m.top + scales.plotHeight / 2
  const xs = xTicks(curve.sliderMax, scales)
  const ys = yTicks(scales)
  const yStep = (scales.yMax - scales.yMin) / layout.tickCountY
  const asymptoteY = scales.y(curve.deltaMax)
  const asymptoteText = `${curve.deltaMax < 0 ? 'limit' : 'max'} ${formatPrice(curve.deltaMax)}`
  const n = (v: number) => v.toFixed(2)

  const parts: string[] = []
  parts.push(
    `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="chart-svg-title" aria-describedby="chart-svg-desc">`,
    '<title id="chart-svg-title">Averaging-down curve: improvement in average price versus capital invested</title>',
    '<desc id="chart-svg-desc"></desc>',
    '<defs>',
    '<linearGradient id="area-gradient" x1="0" y1="0" x2="0" y2="1">',
    '<stop offset="0%" class="gradient-stop" stop-opacity="0.2"/>',
    '<stop offset="100%" class="gradient-stop" stop-opacity="0.02"/>',
    '</linearGradient>',
    `<clipPath id="plot-clip"><rect x="${m.left}" y="${m.top}" width="${n(scales.plotWidth)}" height="${n(scales.plotHeight)}"/></clipPath>`,
    '</defs>',
  )

  // Grid
  for (const tick of xs) parts.push(`<line class="grid-line" x1="${n(tick.pos)}" y1="${m.top}" x2="${n(tick.pos)}" y2="${bottom}"/>`)
  for (const tick of ys) parts.push(`<line class="grid-line" x1="${m.left}" y1="${n(tick.pos)}" x2="${right}" y2="${n(tick.pos)}"/>`)

  // Curve, area and asymptote
  parts.push(
    `<path class="curve-area" d="${buildAreaPath(curve.points, scales)}" fill="url(#area-gradient)" clip-path="url(#plot-clip)"/>`,
    `<path class="curve-line" d="${buildSvgPath(curve.points, scales)}" clip-path="url(#plot-clip)"/>`,
    `<line class="asymptote" x1="${m.left}" y1="${n(asymptoteY)}" x2="${right}" y2="${n(asymptoteY)}"/>`,
    `<text class="asymptote-label" x="${right - 6}" y="${n(asymptoteY - 6)}" text-anchor="end">${escapeXml(asymptoteText)}</text>`,
  )

  // Axes
  parts.push(`<line class="axis-line" x1="${m.left}" y1="${bottom}" x2="${right}" y2="${bottom}"/>`)
  for (const tick of xs) {
    parts.push(
      `<line class="tick-mark" x1="${n(tick.pos)}" y1="${bottom}" x2="${n(tick.pos)}" y2="${bottom + 4}"/>`,
      `<text class="tick-label" x="${n(tick.pos)}" y="${bottom + 17}" text-anchor="middle">${escapeXml(formatCapitalTick(tick.val))}</text>`,
    )
  }
  parts.push(`<line class="axis-line" x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${bottom}"/>`)
  let lastLabelY = Number.POSITIVE_INFINITY
  for (const tick of ys) {
    parts.push(`<line class="tick-mark" x1="${m.left - 4}" y1="${n(tick.pos)}" x2="${m.left}" y2="${n(tick.pos)}"/>`)
    // Skip labels that would overlap (e.g. when the range is almost zero).
    if (lastLabelY - tick.pos >= 13) {
      parts.push(
        `<text class="tick-label" x="${m.left - 8}" y="${n(tick.pos + 4)}" text-anchor="end">${escapeXml(formatDeltaTick(tick.val, yStep))}</text>`,
      )
      lastLabelY = tick.pos
    }
  }
  parts.push(
    `<text class="axis-title" x="${n(m.left + scales.plotWidth / 2)}" y="${h - 6}" text-anchor="middle">Capital invested</text>`,
    `<text class="axis-title" x="12" y="${n(plotMidY)}" text-anchor="middle" transform="rotate(-90 12 ${n(plotMidY)})">Improvement ($)</text>`,
  )

  // Cursor (hidden until an amount is selected)
  parts.push(
    '<g class="cursor" visibility="hidden">',
    `<line class="cursor-line" x1="0" y1="${m.top}" x2="0" y2="${bottom}"/>`,
    '<circle class="cursor-ring" r="7"/>',
    '<circle class="cursor-dot" r="3.5"/>',
    '<rect class="tooltip-bg" rx="5" height="22"/>',
    '<text class="tooltip-text" text-anchor="middle"></text>',
    '</g>',
  )

  // Transparent pointer target over the plot area
  parts.push(
    `<rect class="hit-area" x="${m.left}" y="${m.top}" width="${n(scales.plotWidth)}" height="${n(scales.plotHeight)}"/>`,
    '</svg>',
  )

  root.innerHTML = parts.join('')
  const q = <T extends Element>(selector: string) => root.querySelector(selector) as T

  return {
    curve,
    layout,
    scales,
    cursor: q<SVGGElement>('.cursor'),
    cursorLine: q<SVGLineElement>('.cursor-line'),
    cursorRing: q<SVGCircleElement>('.cursor-ring'),
    cursorDot: q<SVGCircleElement>('.cursor-dot'),
    tooltipBg: q<SVGRectElement>('.tooltip-bg'),
    tooltipText: q<SVGTextElement>('.tooltip-text'),
    desc: q<SVGDescElement>('desc'),
  }
}

function updateCursor(drawn: Drawn, state: State): void {
  const { result } = state
  const visible = state.capital > 0 && result !== null
  drawn.cursor.setAttribute('visibility', visible ? 'visible' : 'hidden')
  if (!visible || !result) return

  const { scales, layout } = drawn
  const cx = scales.x(state.capital)
  const cy = scales.y(result.delta)
  const cxs = cx.toFixed(2)
  const cys = cy.toFixed(2)

  drawn.cursorLine.setAttribute('x1', cxs)
  drawn.cursorLine.setAttribute('x2', cxs)
  drawn.cursorRing.setAttribute('cx', cxs)
  drawn.cursorRing.setAttribute('cy', cys)
  drawn.cursorDot.setAttribute('cx', cxs)
  drawn.cursorDot.setAttribute('cy', cys)

  // The original shows the new average; it falls back to the delta otherwise.
  const label = formatPrice(result.newAverage > 0 ? result.newAverage : result.delta)
  const boxWidth = label.length * 6.9 + 16
  const onLeft = cx > layout.margins.left + scales.plotWidth * 0.65
  const boxX = onLeft ? cx - 12 - boxWidth : cx + 12
  const boxY = Math.max(2, cy - 32)
  drawn.tooltipBg.setAttribute('x', boxX.toFixed(2))
  drawn.tooltipBg.setAttribute('y', boxY.toFixed(2))
  drawn.tooltipBg.setAttribute('width', boxWidth.toFixed(2))
  drawn.tooltipText.setAttribute('x', (boxX + boxWidth / 2).toFixed(2))
  drawn.tooltipText.setAttribute('y', (boxY + 15).toFixed(2))
  setText(drawn.tooltipText, label)
}

function placeholderSvg(layout: ChartLayout): string {
  const { margins: m, width: w, height: h } = layout
  const pw = w - m.left - m.right
  const ph = h - m.top - m.bottom
  const bottom = m.top + ph
  const n = (v: number) => v.toFixed(1)
  return [
    `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Chart placeholder: enter your position to see the curve">`,
    `<path class="placeholder-line" d="M ${m.left},${bottom} C ${n(m.left + pw * 0.15)},${n(bottom - ph * 0.6)} ${n(m.left + pw * 0.4)},${n(m.top + ph * 0.12)} ${m.left + pw},${n(m.top + ph * 0.06)}"/>`,
    `<line class="placeholder-line" x1="${m.left}" y1="${m.top + 10}" x2="${m.left + pw}" y2="${m.top + 10}"/>`,
    `<line class="axis-line" x1="${m.left}" y1="${m.top}" x2="${m.left}" y2="${bottom}"/>`,
    `<line class="axis-line" x1="${m.left}" y1="${bottom}" x2="${m.left + pw}" y2="${bottom}"/>`,
    `<text class="placeholder-title" x="${w / 2}" y="${h / 2 - 10}" text-anchor="middle">Enter your position to see the curve</text>`,
    `<text class="placeholder-sub" x="${w / 2}" y="${h / 2 + 12}" text-anchor="middle">Q₀ · P₀ · Pₘ</text>`,
    '</svg>',
  ].join('')
}
