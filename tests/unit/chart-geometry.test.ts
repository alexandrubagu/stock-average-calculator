import { describe, expect, it } from 'vitest'
import { buildCurvePayload } from '../../src/lib/calculator'
import {
  DEFAULT_LAYOUT,
  buildAreaPath,
  buildSvgPath,
  capitalAtX,
  fmtCoord,
  makeScales,
  plotDimensions,
  xTicks,
  yTicks,
  type ChartLayout,
} from '../../src/lib/chart-geometry'
import { reference } from './fixtures'

const numbersIn = (path: string) => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
const commandsIn = (path: string) => path.replace(/[-\d.,\s]+/g, '')

describe('parity with the original Curve module (640×340 layout)', () => {
  for (const scenario of reference.scenarios) {
    describe(scenario.name, () => {
      const { q0, p0, pm } = scenario.parsed
      const payload = buildCurvePayload(q0, p0, pm)
      const scales = makeScales(payload.sliderMax, payload.deltaMax)

      it('y domain matches', () => {
        expect(scales.yMin).toBe(scenario.chart.y_min)
        expect(scales.yMax).toBe(scenario.chart.y_max)
        expect(scales.yRange).toBe(scenario.chart.y_range)
        expect(scales.y(payload.deltaMax)).toBe(scenario.chart.asymptote_y)
      })

      it('ticks match', () => {
        const xs = xTicks(payload.sliderMax, scales)
        const ys = yTicks(scales)
        expect(xs.map((t) => [t.val, t.pos])).toEqual(scenario.chart.x_ticks.map((t) => [t.val, t.x]))
        expect(ys.map((t) => [t.val, t.pos])).toEqual(scenario.chart.y_ticks.map((t) => [t.val, t.y]))
      })

      it('curve and area paths match', () => {
        for (const [ours, theirs] of [
          [buildSvgPath(payload.points, scales), scenario.chart.svg_path],
          [buildAreaPath(payload.points, scales), scenario.chart.area_path],
        ]) {
          expect(commandsIn(ours)).toBe(commandsIn(theirs))
          const a = numbersIn(ours)
          const b = numbersIn(theirs)
          expect(a).toHaveLength(b.length)
          // Coordinates are printed with 2 decimals on both sides; allow one
          // unit of rounding difference for exact binary ties.
          a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(0.0100001))
        }
      })

      it('contains no NaN or Infinity', () => {
        expect(buildAreaPath(payload.points, scales)).not.toMatch(/NaN|Infinity/)
      })
    })
  }

  it('produces exactly the same path string for the default scenario', () => {
    const scenario = reference.scenarios.find((s) => s.name === 'default')!
    const payload = buildCurvePayload(100, 50, 40)
    expect(buildSvgPath(payload.points, makeScales(payload.sliderMax, payload.deltaMax))).toBe(scenario.chart.svg_path)
  })
})

describe('chart geometry', () => {
  it('has the original plot size', () => {
    expect(plotDimensions()).toEqual({ width: 556, height: 260 })
  })

  it('returns an empty path for fewer than two points', () => {
    const scales = makeScales(100, 10)
    expect(buildSvgPath([{ capital: 0, delta: 0 }], scales)).toBe('')
    expect(buildAreaPath([], scales)).toBe('')
  })

  it('draws a curve that never goes back up the screen (monotone)', () => {
    const payload = buildCurvePayload(37, 123.456, 98.765)
    const path = buildSvgPath(payload.points, makeScales(payload.sliderMax, payload.deltaMax))
    const ys = numbersIn(path).filter((_, i) => i % 2 === 1)
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] + 0.01)
  })

  it('supports other layouts (responsive chart)', () => {
    const layout: ChartLayout = { ...DEFAULT_LAYOUT, width: 360, height: 240, tickCountX: 3 }
    const scales = makeScales(36_000, 10, layout)
    expect(scales.x(0)).toBe(layout.margins.left)
    expect(scales.x(36_000)).toBe(360 - layout.margins.right)
    expect(xTicks(36_000, scales).map((t) => t.val)).toEqual([0, 12_000, 24_000, 36_000])
  })

  it('maps a pointer x position back to a clamped capital', () => {
    const scales = makeScales(36_000, 10)
    expect(capitalAtX(scales.x(9_000), 36_000, scales)).toBeCloseTo(9_000, 6)
    expect(capitalAtX(0, 36_000, scales)).toBe(0)
    expect(capitalAtX(10_000, 36_000, scales)).toBe(36_000)
  })

  it('formats coordinates like Erlang float_to_binary(decimals: 2, :compact)', () => {
    expect(fmtCoord(60)).toBe('60.0')
    expect(fmtCoord(143.4)).toBe('143.4')
    expect(fmtCoord(59.234)).toBe('59.23')
    expect(fmtCoord(0.125)).toBe('0.13')
    expect(fmtCoord(1.005)).toBe('1.0')
  })
})
