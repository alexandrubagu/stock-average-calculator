import { describe, expect, it } from 'vitest'
import { EXAMPLE, FALLBACK_SLIDER_MAX, blur, initialState, input, load, setCapital, type State } from '../../src/state/store'

const fill = (state: State, q0: string, p0: string, pm: string) =>
  input(input(input(state, 'q0', q0), 'p0', p0), 'pm', pm)

describe('store (mirrors the LiveView event handlers)', () => {
  it('starts empty with no curve', () => {
    const s = initialState()
    expect(s.raw).toEqual({ q0: '', p0: '', pm: '' })
    expect(s.curve).toBeNull()
    expect(s.result).toBeNull()
    expect(s.capital).toBe(0)
  })

  it('shows an error only after the field has been blurred', () => {
    let s = input(initialState(), 'q0', 'abc')
    expect(s.errors).toEqual({})
    s = blur(s, 'q0')
    expect(s.errors.q0).toBeDefined()
    s = input(s, 'q0', '100')
    expect(s.errors.q0).toBeUndefined()
    s = input(s, 'q0', '0')
    expect(s.errors.q0).toBeDefined()
  })

  it('computes the curve once all three inputs are valid', () => {
    const s = fill(initialState(), '100', '50', '40')
    expect(s.curve?.sliderMax).toBe(36_000)
    expect(s.result?.capitalActual).toBe(0)
  })

  it('updates the result when the capital changes and clamps it to the slider range', () => {
    let s = fill(initialState(), '100', '50', '40')
    s = setCapital(s, 350)
    expect(s.result?.sharesAdditional).toBe(8)
    s = setCapital(s, 1e9)
    expect(s.capital).toBe(36_000)
    s = setCapital(s, -5)
    expect(s.capital).toBe(0)
  })

  it('keeps the capital while inputs are invalid and re-clamps it when they become valid', () => {
    let s = setCapital(fill(initialState(), '100', '50', '40'), 30_000)
    s = input(s, 'pm', '')
    expect(s.curve).toBeNull()
    expect(s.result).toBeNull()
    expect(s.capital).toBe(30_000)
    // New bound: 9 × 100 × 20 = 18,000
    s = input(s, 'pm', '20')
    expect(s.curve?.sliderMax).toBe(18_000)
    expect(s.capital).toBe(18_000)
    expect(s.result?.sharesAdditional).toBe(900)
  })

  it('without a curve, capital is clamped to the original fallback bound', () => {
    expect(setCapital(initialState(), 50_000).capital).toBe(FALLBACK_SLIDER_MAX)
  })

  it('loads the example position', () => {
    const s = load(initialState(), EXAMPLE.raw, EXAMPLE.capital)
    expect(s.result?.newAverage).toBe(45)
    expect(s.result?.pctOfMax).toBe(0.5)
    expect(s.errors).toEqual({})
  })

  it('explains invalid values from a shared link immediately', () => {
    const s = load(initialState(), { q0: 'ten', p0: '50', pm: '40' }, 100)
    expect(s.errors.q0).toBeDefined()
    expect(s.curve).toBeNull()
  })

  it('reuses the curve when the parsed inputs did not change', () => {
    const s = fill(initialState(), '100', '50', '40')
    const t = input(s, 'p0', '50.0')
    expect(t.curve).toBe(s.curve)
  })
})
