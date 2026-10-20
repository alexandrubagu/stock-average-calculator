import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  computeAllErrors,
  parsePrice,
  parseShares,
  parseValidInputs,
  visibleErrors,
} from '../../src/lib/validation'

// Behaviour of the original LiveView, verified with `Integer.parse/1` and
// `Float.parse/1` in Elixir 1.18: the whole string must be consumed.
describe('shares held (Q₀) — Integer.parse semantics', () => {
  it.each([
    ['100', 100],
    ['+5', 5],
    ['007', 7],
    ['1', 1],
  ])('accepts %j', (raw, value) => {
    expect(parseShares(raw)).toEqual({ ok: true, value })
  })

  it.each(['', '0', '-0', '-5', '100.0', '1e3', '12abc', 'abc', '1,000', '1_000', '10.5'])('rejects %j', (raw) => {
    expect(parseShares(raw).ok).toBe(false)
  })

  it('caps the share count so every derived share count stays an exact integer', () => {
    expect(parseShares(String(LIMITS.maxShares)).ok).toBe(true)
    expect(parseShares(String(LIMITS.maxShares + 1)).ok).toBe(false)
  })

  it('explains how to fix each problem', () => {
    const error = (raw: string) => {
      const r = parseShares(raw)
      return r.ok ? '' : r.error
    }
    expect(error('')).toMatch(/whole number/)
    expect(error('0')).toBe('Must be a whole number ≥ 1.')
    expect(error('10.5')).toMatch(/without decimals/)
    expect(error('1,000')).toMatch(/thousands separators/)
    expect(error('abc')).toMatch(/whole number ≥ 1/)
  })
})

describe('prices (P₀, Pₘ) — Float.parse semantics', () => {
  it.each([
    ['50', 50],
    ['50.25', 50.25],
    ['1e3', 1000],
    ['1.5e2', 150],
    ['+5', 5],
    ['00.5', 0.5],
    ['0.0001', 0.0001],
  ])('accepts %j like the original', (raw, value) => {
    expect(parsePrice(raw, 'p0')).toEqual({ ok: true, value })
  })

  it.each(['', '0', '0.0', '-5', '-0', 'abc', '5e', '1,000', '1_000', '0x10', 'Infinity', 'NaN', '1e309'])(
    'rejects %j like the original',
    (raw) => {
      expect(parsePrice(raw, 'pm').ok).toBe(false)
    },
  )

  // Documented leniency: the original rejected these.
  it.each([
    ['.5', 0.5],
    ['50.', 50],
    [' 5', 5],
    ['5 ', 5],
  ])('also accepts %j (deliberate leniency)', (raw, value) => {
    expect(parsePrice(raw, 'p0')).toEqual({ ok: true, value })
  })

  it('caps prices at one billion', () => {
    expect(parsePrice('1000000000', 'p0').ok).toBe(true)
    expect(parsePrice('1000000000.01', 'p0').ok).toBe(false)
  })

  it('gives a specific hint for comma-formatted numbers', () => {
    const r = parsePrice('12,50', 'pm')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/dot for decimals/)
  })

  it('keeps the original meaning in its messages', () => {
    const r = parsePrice('-3', 'p0')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/positive number/)
  })
})

describe('form-level validation', () => {
  it('parses only when all three fields are valid', () => {
    expect(parseValidInputs({ q0: '100', p0: '50', pm: '40' })).toEqual({ q0: 100, p0: 50, pm: 40 })
    expect(parseValidInputs({ q0: '100', p0: '50', pm: '' })).toBeNull()
    expect(parseValidInputs({ q0: '0', p0: '50', pm: '40' })).toBeNull()
  })

  it('reports every invalid field', () => {
    expect(Object.keys(computeAllErrors({ q0: '', p0: 'x', pm: '40' })).sort()).toEqual(['p0', 'q0'])
  })

  it('shows errors only for touched fields (the original visible_errors/2)', () => {
    const raw = { q0: '', p0: '', pm: '' }
    expect(visibleErrors(raw, {})).toEqual({})
    expect(Object.keys(visibleErrors(raw, { p0: true }))).toEqual(['p0'])
  })
})
