import { describe, expect, it } from 'vitest'
import {
  formatCapitalAmount,
  formatCapitalTick,
  formatDeltaTick,
  formatEfficiency,
  formatMoney,
  formatPercentOfMax,
  formatPrice,
  formatShares,
  roundHalfAwayFromZero,
} from '../../src/lib/format'
import { reference } from './fixtures'

describe('formatCapitalTick vs the original format_capital/1', () => {
  // Values where the original output is kept; the rest are documented changes.
  const changed = new Map([
    [0.4, '$0.4'], // original "$0" — small amounts keep decimals
    [0.5, '$0.5'], // original "$1"
    [999.6, '$1.0k'], // original "$1000"
    [999_999, '$1.0M'], // original "$1000k"
    [2.5e9, '$2.5B'], // original "$2.5e3M"
  ])

  for (const { val, label } of reference.formatters.format_capital) {
    const expected = changed.get(val) ?? label
    it(`${val} → ${expected}${changed.has(val) ? ` (original ${label})` : ''}`, () => {
      expect(formatCapitalTick(val)).toBe(expected)
    })
  }

  it('matches every slider-maximum label of the reference scenarios', () => {
    const changedScenarios = new Set(['large-position', 'small-decimals', 'tiny-market-price'])
    for (const s of reference.scenarios) {
      if (changedScenarios.has(s.name)) continue
      expect(formatCapitalTick(s.slider_max), s.name).toBe(s.chart.slider_max_label)
    }
    expect(formatCapitalTick(87_750_000_000)).toBe('$87.8B') // original "$87750.0M"
    expect(formatCapitalTick(1.89)).toBe('$1.89') // original "$2"
  })
})

describe('formatDeltaTick', () => {
  it('uses the original thresholds for ordinary ranges', () => {
    expect(formatDeltaTick(2, 2)).toBe('$2.0')
    expect(formatDeltaTick(10, 2)).toBe('$10.0')
    expect(formatDeltaTick(150, 50)).toBe('$150')
    expect(formatDeltaTick(50_000, 10_000)).toBe('$50,000')
    expect(formatDeltaTick(-10, 2)).toBe('-$10.0')
  })

  it('keeps neighbouring labels distinct on small ranges', () => {
    const labels = [0, 0.00072, 0.00144, 0.00216].map((v) => formatDeltaTick(v, 0.00072))
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels[1]).toBe('$0.00072')
  })
})

describe('money and prices', () => {
  it('formats money with fixed decimals and grouping', () => {
    expect(formatMoney(4026)).toBe('$4,026.00')
    expect(formatMoney(4026, 0)).toBe('$4,026')
    expect(formatMoney(-0)).toBe('$0.00')
    expect(formatMoney(-5)).toBe('-$5.00')
  })

  it('formats prices with extra decimals below $1', () => {
    expect(formatPrice(45)).toBe('$45.00')
    expect(formatPrice(49.25925925925926)).toBe('$49.26')
    expect(formatPrice(0)).toBe('$0.00')
    expect(formatPrice(0.5)).toBe('$0.50')
    expect(formatPrice(0.0036)).toBe('$0.0036')
    expect(formatPrice(0.07529411764705882)).toBe('$0.07529')
    expect(formatPrice(-0.0012)).toBe('-$0.0012')
  })

  it('formats the capital card in whole dollars from $100', () => {
    expect(formatCapitalAmount(4026.4)).toBe('$4,026')
    expect(formatCapitalAmount(0.98)).toBe('$0.98')
    expect(formatCapitalAmount(0)).toBe('$0.00')
  })

  it('formats shares, efficiency and percent of max', () => {
    expect(formatShares(1234567)).toBe('1,234,567')
    expect(formatEfficiency(0.00125)).toBe('0.1250%')
    expect(formatEfficiency(0.0042866941015089165)).toBe('0.4287%')
    expect(formatPercentOfMax(0.07407407407407407)).toBe('7%')
    expect(formatPercentOfMax(0.5)).toBe('50%')
    expect(formatPercentOfMax(0.995)).toBe('100%')
  })

  it('rounds half away from zero like Elixir round/1', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3)
    expect(roundHalfAwayFromZero(14.5)).toBe(15)
  })
})
