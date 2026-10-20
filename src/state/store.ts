/**
 * Calculator state and its transitions, kept free of DOM code.
 *
 * Mirrors the original LiveView's event handlers:
 *   input(field, value)  ← handle_event("input_change")
 *   blur(field)          ← handle_event("field_blur")
 *   setCapital(capital)  ← handle_event("slider_settled")
 * plus the additions `load` (example / shared link) and `initialState` (reset).
 */
import { buildCurvePayload, computeSimResult, type CurvePayload, type SimResult } from '../lib/calculator'
import {
  parseValidInputs,
  visibleErrors,
  type Field,
  type FieldErrors,
  type RawInputs,
  type ValidInputs,
} from '../lib/validation'

export interface State {
  raw: RawInputs
  touched: Partial<Record<Field, boolean>>
  /** Errors for touched fields only. */
  errors: FieldErrors
  inputs: ValidInputs | null
  curve: CurvePayload | null
  /** Requested capital (slider / amount field), clamped to [0, sliderMax]. */
  capital: number
  result: SimResult | null
}

/** Slider bound used while there is no curve (the original's fallback). */
export const FALLBACK_SLIDER_MAX = 10_000

export const EXAMPLE: { raw: RawInputs; capital: number } = {
  raw: { q0: '100', p0: '50', pm: '40' },
  capital: 4000,
}

export function initialState(): State {
  return {
    raw: { q0: '', p0: '', pm: '' },
    touched: {},
    errors: {},
    inputs: null,
    curve: null,
    capital: 0,
    result: null,
  }
}

export function input(state: State, field: Field, value: string): State {
  const raw = { ...state.raw, [field]: value }
  return recompute({ ...state, raw, errors: visibleErrors(raw, state.touched) })
}

export function blur(state: State, field: Field): State {
  if (state.touched[field]) return state
  const touched = { ...state.touched, [field]: true }
  return { ...state, touched, errors: visibleErrors(state.raw, touched) }
}

export function setCapital(state: State, capital: number): State {
  const value = clamp(Number.isFinite(capital) ? capital : 0, 0, sliderMaxOf(state))
  if (value === state.capital && state.result) return state
  const { inputs } = state
  const result = state.curve && inputs ? computeSimResult(inputs.q0, inputs.p0, inputs.pm, value) : null
  return { ...state, capital: value, result }
}

/**
 * Replaces all three inputs at once (example button, shared link). Non-empty
 * fields count as touched so problems in a shared link are explained.
 */
export function load(state: State, raw: RawInputs, capital = 0): State {
  const touched: Partial<Record<Field, boolean>> = {
    q0: raw.q0 !== '',
    p0: raw.p0 !== '',
    pm: raw.pm !== '',
  }
  const next = recompute({ ...state, raw, touched, errors: visibleErrors(raw, touched), capital })
  return setCapital(next, capital)
}

export function sliderMaxOf(state: State): number {
  return state.curve ? state.curve.sliderMax : FALLBACK_SLIDER_MAX
}

/** The original's `recompute_if_valid/1`. */
function recompute(state: State): State {
  const inputs = parseValidInputs(state.raw)
  if (!inputs) {
    // The capital amount is kept so it can be reapplied once inputs are valid.
    return { ...state, inputs: null, curve: null, result: null }
  }

  const same =
    state.inputs !== null &&
    state.curve !== null &&
    state.inputs.q0 === inputs.q0 &&
    state.inputs.p0 === inputs.p0 &&
    state.inputs.pm === inputs.pm
  const curve = same && state.curve ? state.curve : buildCurvePayload(inputs.q0, inputs.p0, inputs.pm)
  const capital = clamp(state.capital, 0, curve.sliderMax)
  const result = computeSimResult(inputs.q0, inputs.p0, inputs.pm, capital)
  return { ...state, inputs, curve, capital, result }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max))
}
