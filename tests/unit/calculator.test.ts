import { describe, expect, it } from 'vitest'
import {
  CURVE_POINTS,
  buildCurvePayload,
  computeDelta,
  computeDeltaMax,
  computeEfficiency,
  computeNewAverage,
  computePmEff,
  computeSharesToBuy,
  computeSimResult,
  computeSliderMax,
  generateCurvePoints,
  sliderStep,
} from '../../src/lib/calculator'
import { Decimal } from '../../src/lib/decimal'
import { expectClose, reference } from './fixtures'

const approx = (a: number, b: number, tol = 0.000001) => Math.abs(a - b) < tol

// Scenario used by the original ExUnit suite: q0=100, p0=$50, pm=$40, capital=$200.
const Q0 = 100
const P0 = '50'
const PM = '40'
const CAPITAL = '200'

describe('ported ExUnit cases (test/avgr/calculator_test.exs)', () => {
  it('computePmEff: no fee returns pm unchanged', () => {
    expect(computePmEff('40', '0').eq(40)).toBe(true)
  })

  it('computePmEff: 1% fee', () => {
    expect(approx(computePmEff('40', '0.01').toNumber(), 40.4)).toBe(true)
  })

  it('computeNewAverage: zero capital returns p0', () => {
    expect(computeNewAverage(100, '50', '40', 0).toNumber()).toBe(50)
  })

  it('computeNewAverage: buying at market reduces average', () => {
    // 200 / 40 = 5 new shares; (100*50 + 200) / (100 + 5) = 5200/105 ≈ 49.524
    expect(approx(computeNewAverage(Q0, P0, PM, CAPITAL).toNumber(), 49.52380952, 0.00001)).toBe(true)
  })

  it('computeDelta: improvement is p0 minus new average', () => {
    const pNew = computeNewAverage(Q0, P0, PM, CAPITAL)
    expect(approx(computeDelta(P0, pNew).toNumber(), 0.47619047, 0.00001)).toBe(true)
  })

  it('computeDelta: zero capital gives zero delta', () => {
    expect(computeDelta('50', '50').eq(0)).toBe(true)
  })

  it('computeDeltaMax: p0 - pm, negative when averaging up', () => {
    expect(computeDeltaMax(P0, PM).toNumber()).toBe(10)
    expect(computeDeltaMax('50', '60').toNumber()).toBe(-10)
  })

  it('computeSharesToBuy floors fractional shares', () => {
    expect(computeSharesToBuy('40', '201')).toBe(5)
    expect(computeSharesToBuy('40', '200')).toBe(5)
    expect(computeSharesToBuy('40', '0')).toBe(0)
  })

  // The ExUnit case "compute_efficiency with zero capital returns 0" is not ported: it
  // passes a literal integer 0, which hits a guard that a Decimal capital never
  // matches, so the app always uses the general formula (see the test below).
  it('computeEfficiency is positive for valid inputs', () => {
    expect(computeEfficiency(Q0, P0, PM, CAPITAL).toNumber()).toBeGreaterThan(0)
  })

  it('computeSliderMax: positive for averaging down and reaches ~90% of deltaMax', () => {
    const sliderMax = computeSliderMax(Q0, P0, PM)
    expect(sliderMax.toNumber()).toBeGreaterThan(0)
    const pNew = computeNewAverage(Q0, P0, computePmEff(PM, '0'), sliderMax)
    const target = new Decimal(PM).plus(new Decimal(P0).minus(PM).times('0.1'))
    expect(target.minus(pNew).abs().toNumber()).toBeLessThan(0.1)
  })

  it('computeSliderMax: 10× fallback when averaging up', () => {
    expect(computeSliderMax(100, '40', '50').toNumber()).toBe(40_000)
  })

  it('generateCurvePoints: 121 points, first delta 0, non-decreasing, last at sliderMax', () => {
    const sliderMax = computeSliderMax(Q0, P0, PM)
    const points = generateCurvePoints(Q0, P0, computePmEff(PM, '0'), sliderMax)
    expect(points).toHaveLength(CURVE_POINTS + 1)
    expect(points[0].delta).toBe(0)
    for (let i = 1; i < points.length; i++) {
      expect(points[i].delta).toBeGreaterThanOrEqual(points[i - 1].delta - 0.000001)
    }
    expect(approx(points[points.length - 1].capital, sliderMax.toNumber(), 0.01)).toBe(true)
  })

  it('buildCurvePayload: a fee lowers the delta at the same capital', () => {
    const noFee = buildCurvePayload(Q0, P0, PM)
    const withFee = buildCurvePayload(Q0, P0, PM, '0.01')
    expect(noFee.points[1].delta).toBeGreaterThanOrEqual(withFee.points[1].delta)
  })
})

describe('parity with the original Elixir implementation', () => {
  for (const scenario of reference.scenarios) {
    describe(scenario.name, () => {
      const { q0, p0, pm } = scenario.parsed
      const payload = buildCurvePayload(q0, p0, pm)

      it('slider bound and asymptote match', () => {
        expect(payload.sliderMax).toBe(scenario.slider_max)
        expect(payload.deltaMax).toBe(scenario.delta_max)
      })

      it('all 121 curve points match', () => {
        expect(payload.points).toHaveLength(scenario.points.length)
        payload.points.forEach((point, i) => {
          const ref = scenario.points[i]
          expect(point.shares, `shares @${i}`).toBe(ref.shares)
          expect(expectClose(point.capital, ref.capital), `capital @${i}`).toBe(true)
          expect(expectClose(point.capitalActual, ref.capital_actual), `capitalActual @${i}`).toBe(true)
          expect(expectClose(point.delta, ref.delta), `delta @${i}`).toBe(true)
          expect(expectClose(point.newAverage, ref.new_average), `newAverage @${i}`).toBe(true)
          expect(expectClose(point.efficiencyPer100, ref.efficiency_per_100), `efficiency @${i}`).toBe(true)
        })
      })

      it('simulation results match at every reference capital', () => {
        for (const sim of scenario.sims) {
          const capital = Math.max(0, Math.min(sim.input_capital, payload.sliderMax))
          expect(capital).toBe(sim.capital)
          const r = computeSimResult(q0, p0, pm, capital)
          const ref = sim.result
          const at = `capital ${capital}`
          expect(r.sharesAdditional, at).toBe(ref.shares_additional)
          expect(r.isAveragingUp, at).toBe(ref.is_averaging_up)
          expect(r.isAveragingFlat, at).toBe(ref.is_averaging_flat)
          const pairs: [number, number, string][] = [
            [r.capital, ref.capital, 'capital'],
            [r.capitalActual, ref.capital_actual, 'capitalActual'],
            [r.newAverage, ref.new_average, 'newAverage'],
            [r.delta, ref.delta, 'delta'],
            [r.deltaMax, ref.delta_max, 'deltaMax'],
            [r.deltaPct, ref.delta_pct, 'deltaPct'],
            [r.efficiency, ref.efficiency, 'efficiency'],
            [r.efficiencyPer100, ref.efficiency_per_100, 'efficiencyPer100'],
            [r.pctOfMax, ref.pct_of_max, 'pctOfMax'],
          ]
          for (const [actual, expected, name] of pairs) {
            expect(expectClose(actual, expected), `${name} at ${at}: ${actual} vs ${expected}`).toBe(true)
          }
        }
      })
    })
  }
})

describe('worked example used in the page content', () => {
  // 100 shares at $50, market price $40.
  const result = (capital: number) => computeSimResult(100, 50, 40, capital)

  it('$4,000 buys 100 shares and moves the average to $45 (50% of max)', () => {
    const r = result(4000)
    expect(r.sharesAdditional).toBe(100)
    expect(r.capitalActual).toBe(4000)
    expect(r.newAverage).toBe(45)
    expect(r.delta).toBe(5)
    expect(r.pctOfMax).toBe(0.5)
    // Marginal efficiency: the next $100 lowers the average by 0.1250% of P0.
    expect((r.efficiencyPer100 * 100).toFixed(4)).toBe('0.1250')
  })

  it('$36,000 (the slider maximum) buys 900 shares and reaches $41 (90% of max)', () => {
    expect(buildCurvePayload(100, 50, 40).sliderMax).toBe(36_000)
    const r = result(36_000)
    expect(r.sharesAdditional).toBe(900)
    expect(r.newAverage).toBe(41)
    expect(r.delta).toBe(9)
    expect(r.pctOfMax).toBe(0.9)
  })

  it('$12,000 buys 300 shares and reaches $42.50 (75% of max)', () => {
    const r = result(12_000)
    expect(r.sharesAdditional).toBe(300)
    expect(r.newAverage).toBe(42.5)
    expect(r.delta).toBe(7.5)
    expect(r.pctOfMax).toBe(0.75)
  })

  it('the first $4,000 achieves more than the next $32,000', () => {
    const first = result(4000).delta
    const next = result(36_000).delta - first
    expect(first).toBeGreaterThan(next)
  })

  it('$350 buys only 8 whole shares ($320)', () => {
    const r = result(350)
    expect(r.sharesAdditional).toBe(8)
    expect(r.capitalActual).toBe(320)
  })
})

describe('multiple purchases', () => {
  it('two purchases at the same price equal one combined purchase', () => {
    const q0 = 120
    const p0 = new Decimal('37.85')
    const pm = new Decimal('29.4')
    const first = 30
    const second = 45

    const afterFirst = computeNewAverage(q0, p0, pm, pm.times(first))
    const afterSecond = computeNewAverage(q0 + first, afterFirst, pm, pm.times(second))
    const combined = computeNewAverage(q0, p0, pm, pm.times(first + second))

    expect(afterSecond.minus(combined).abs().lt('1e-24')).toBe(true)
  })

  it('sequential purchases at different prices give the share-weighted average', () => {
    // 50 @ $20, then 25 @ $14, then 25 @ $11 → (1000 + 350 + 275) / 100 = 16.25
    const step1 = computeNewAverage(50, 20, 14, 25 * 14)
    const step2 = computeNewAverage(75, step1, 11, 25 * 11)
    expect(step2.toNumber()).toBe(16.25)
  })
})

describe('decimal precision and boundaries', () => {
  it('avoids binary floating-point errors when flooring shares', () => {
    // 0.3 / 0.1 is 2.9999999999999996 in IEEE doubles.
    expect(0.3 / 0.1).toBeLessThan(3)
    expect(computeSharesToBuy(0.1, 0.3)).toBe(3)
    expect(computeSharesToBuy('0.07', '0.21')).toBe(3)
  })

  it('capital just below one share price buys nothing and keeps the average', () => {
    const r = computeSimResult(100, 50, 40, 39.99)
    expect(r.sharesAdditional).toBe(0)
    expect(r.capitalActual).toBe(0)
    expect(r.newAverage).toBe(50)
    expect(r.delta).toBe(0)
    expect(r.pctOfMax).toBe(0)
  })

  it('zero capital has a non-zero marginal efficiency (original behaviour)', () => {
    const r = computeSimResult(100, 50, 40, 0)
    expect(r.efficiencyPer100).toBe(0.005)
  })

  it('averaging up: negative delta, pctOfMax 0, absolute efficiency', () => {
    const r = computeSimResult(100, 40, 50, 5000)
    expect(r.isAveragingUp).toBe(true)
    expect(r.sharesAdditional).toBe(100)
    expect(r.newAverage).toBe(45)
    expect(r.delta).toBe(-5)
    expect(r.pctOfMax).toBe(0)
    expect(r.efficiency).toBeGreaterThan(0)
  })

  it('flat position: delta is always 0', () => {
    const payload = buildCurvePayload(100, 50, 50)
    expect(payload.deltaMax).toBe(0)
    expect(payload.sliderMax).toBe(50_000)
    expect(payload.points.every((p) => p.delta === 0)).toBe(true)
    expect(computeSimResult(100, 50, 50, 1000).isAveragingFlat).toBe(true)
  })

  it('largest allowed inputs keep share counts exact and values finite', () => {
    const payload = buildCurvePayload(1e12, 1e9, 1)
    expect(Number.isFinite(payload.sliderMax)).toBe(true)
    const last = payload.points[payload.points.length - 1]
    expect(Number.isSafeInteger(last.shares)).toBe(true)
    const up = buildCurvePayload(1e12, 1, 1e9)
    expect(up.sliderMax).toBe(1e13)
    expect(Number.isFinite(computeSimResult(1e12, 1e9, 1e9, 1e22).capitalActual)).toBe(true)
  })

  it('slider step is 1/500 of the range but never below $1', () => {
    expect(sliderStep(36_000)).toBe(72)
    expect(sliderStep(100)).toBe(1)
  })
})
