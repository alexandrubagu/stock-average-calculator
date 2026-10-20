/**
 * Chart geometry for the efficiency curve — a port of the original
 * `AvgrWeb.Components.Curve` (Elixir), which itself ported `curve.ts`.
 *
 * The math is unchanged; the only addition is that the viewBox size, margins
 * and tick counts are parameters, so the chart can be laid out at the
 * container's real pixel width. `DEFAULT_LAYOUT` holds the original values.
 */

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ChartLayout {
  width: number
  height: number
  margins: Margins
  tickCountX: number
  tickCountY: number
}

export const DEFAULT_LAYOUT: ChartLayout = {
  width: 640,
  height: 340,
  margins: { top: 28, right: 24, bottom: 52, left: 60 },
  tickCountX: 5,
  tickCountY: 5,
}

export interface Scales {
  x: (capital: number) => number
  y: (delta: number) => number
  yMin: number
  yMax: number
  yRange: number
  plotWidth: number
  plotHeight: number
  layout: ChartLayout
}

export interface XYPoint {
  capital: number
  delta: number
}

export interface Tick {
  val: number
  pos: number
}

export function plotDimensions(layout: ChartLayout = DEFAULT_LAYOUT): { width: number; height: number } {
  const { width, height, margins } = layout
  return {
    width: width - margins.left - margins.right,
    height: height - margins.top - margins.bottom,
  }
}

/**
 * Scale functions. The y domain always includes 0, so it works for
 * averaging down (deltaMax > 0) and averaging up (deltaMax < 0).
 */
export function makeScales(sliderMax: number, deltaMax: number, layout: ChartLayout = DEFAULT_LAYOUT): Scales {
  const { width, height } = plotDimensions(layout)
  const { margins } = layout
  const yMin = Math.min(0, deltaMax)
  const yMax = Math.max(0, deltaMax)
  const yRange = Math.abs(deltaMax) < 0.0001 ? 1 : yMax - yMin

  return {
    x: (capital) => margins.left + (capital / sliderMax) * width,
    y: (delta) => margins.top + (1 - (delta - yMin) / yRange) * height,
    yMin,
    yMax,
    yRange,
    plotWidth: width,
    plotHeight: height,
    layout,
  }
}

/**
 * Monotone cubic Hermite path (Fritsch–Carlson) through the curve points,
 * emitted as SVG cubic Bézier segments.
 */
export function buildSvgPath(points: readonly XYPoint[], scales: Scales): string {
  if (points.length < 2) return ''

  const xs = points.map((p) => scales.x(p.capital))
  const ys = points.map((p) => scales.y(p.delta))
  const n = xs.length

  // Step 1: secant slopes between consecutive points.
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const h = xs[i + 1] - xs[i]
    const dy = ys[i + 1] - ys[i]
    dx.push(h)
    m.push(h === 0 ? 0 : dy / h)
  }

  // Step 2: initial tangents (one-sided at the ends, averaged inside).
  const t: number[] = []
  for (let i = 0; i < n; i++) {
    if (i === 0) t.push(m[0])
    else if (i === n - 1) t.push(m[n - 2])
    else t.push((m[i - 1] + m[i]) / 2)
  }

  // Step 3: Fritsch–Carlson constraint keeps each segment monotone.
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(m[i]) < 1e-10) {
      t[i] = 0
      t[i + 1] = 0
    } else {
      const alpha = t[i] / m[i]
      const beta = t[i + 1] / m[i]
      const s = alpha * alpha + beta * beta
      if (s > 9) {
        const tau = 3 / Math.sqrt(s)
        t[i] = tau * alpha * m[i]
        t[i + 1] = tau * beta * m[i]
      }
    }
  }

  // Step 4: cubic Bézier control points.
  let path = `M ${fmtCoord(xs[0])},${fmtCoord(ys[0])}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i]
    const cp1x = xs[i] + h / 3
    const cp1y = ys[i] + (t[i] * h) / 3
    const cp2x = xs[i + 1] - h / 3
    const cp2y = ys[i + 1] - (t[i + 1] * h) / 3
    path += ` C ${fmtCoord(cp1x)},${fmtCoord(cp1y)} ${fmtCoord(cp2x)},${fmtCoord(cp2y)} ${fmtCoord(xs[i + 1])},${fmtCoord(ys[i + 1])}`
  }
  return path
}

/** Area under the curve, closed down to the zero-delta baseline. */
export function buildAreaPath(points: readonly XYPoint[], scales: Scales): string {
  if (points.length < 2) return ''
  const curve = buildSvgPath(points, scales)
  const lastX = fmtCoord(scales.x(points[points.length - 1].capital))
  const firstX = fmtCoord(scales.x(points[0].capital))
  const zeroY = fmtCoord(scales.y(0))
  return `${curve} L ${lastX},${zeroY} L ${firstX},${zeroY} Z`
}

export function xTicks(sliderMax: number, scales: Scales): Tick[] {
  const count = scales.layout.tickCountX
  const ticks: Tick[] = []
  for (let i = 0; i <= count; i++) {
    const val = (i / count) * sliderMax
    ticks.push({ val, pos: scales.x(val) })
  }
  return ticks
}

export function yTicks(scales: Scales): Tick[] {
  const count = scales.layout.tickCountY
  const ticks: Tick[] = []
  for (let i = 0; i <= count; i++) {
    const val = scales.yMin + (i / count) * (scales.yMax - scales.yMin)
    ticks.push({ val, pos: scales.y(val) })
  }
  return ticks
}

/** Maps a pixel x position back to a capital amount within [0, sliderMax]. */
export function capitalAtX(x: number, sliderMax: number, scales: Scales): number {
  const ratio = (x - scales.layout.margins.left) / scales.plotWidth
  return Math.min(Math.max(ratio, 0), 1) * sliderMax
}

/**
 * Coordinate formatting identical to Erlang's
 * `float_to_binary(v, [{:decimals, 2}, :compact])`: two decimals with
 * trailing zeros removed, but always at least one decimal digit.
 */
export function fmtCoord(value: number): string {
  const [int, frac = ''] = value.toFixed(2).split('.')
  return `${int}.${frac.replace(/0+$/, '') || '0'}`
}
