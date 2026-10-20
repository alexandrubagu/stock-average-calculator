/**
 * Parsing and validation of the three raw text inputs.
 *
 * Base rules come from the original LiveView (`parse_valid_inputs/1` and
 * `compute_all_errors/1`):
 *   q0  — `Integer.parse/1` must consume the whole string and give ≥ 1
 *   p0  — `Float.parse/1` must consume the whole string and give > 0
 *   pm  — same as p0
 *
 * Deliberate, documented differences (see README "Deviations"):
 *   - surrounding whitespace is ignored ("5 " was rejected by the original)
 *   - ".5" and "50." are accepted as prices (the original rejected them)
 *   - upper bounds keep every derived number finite and share counts exact
 *     in IEEE doubles (the original accepted unbounded values)
 *   - error messages say how to fix the problem
 */

export type Field = 'q0' | 'p0' | 'pm'

export const FIELDS: readonly Field[] = ['q0', 'p0', 'pm']

export interface RawInputs {
  q0: string
  p0: string
  pm: string
}

export interface ValidInputs {
  q0: number
  p0: number
  pm: number
}

export type FieldErrors = Partial<Record<Field, string>>

export const LIMITS = {
  /** 1e12 shares keeps every share count (≤ 10·q0) below 2^53. */
  maxShares: 1_000_000_000_000,
  /** Keeps the largest slider bound (10·q0·p0) far below Number.MAX_VALUE. */
  maxPrice: 1_000_000_000,
} as const

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

// Integer.parse/1 accepts an optional sign followed by digits.
const INTEGER_RE = /^[+-]?\d+$/
// Float.parse/1 syntax ("50", "50.25", "1e3", "+5"), plus ".5" and "50.".
const DECIMAL_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
const LOOKS_GROUPED_RE = /^[+-]?[\d.,\s_']+$/

const PRICE_LABELS: Record<'p0' | 'pm', string> = {
  p0: 'your average buy price',
  pm: 'the current market price',
}

export function parseShares(raw: string): ParseResult {
  const text = raw.trim()
  if (text === '') {
    return { ok: false, error: 'Enter how many shares you hold — a whole number such as 100.' }
  }
  if (!INTEGER_RE.test(text)) {
    if (/^[+-]?\d*\.\d+$/.test(text) || /^[+-]?\d+\.$/.test(text)) {
      return { ok: false, error: 'Must be a whole number of shares, without decimals (e.g. 100).' }
    }
    if (LOOKS_GROUPED_RE.test(text)) {
      return { ok: false, error: 'Remove thousands separators — type 1000, not 1,000.' }
    }
    return { ok: false, error: 'Must be a whole number ≥ 1, such as 100.' }
  }
  const value = Number(text)
  if (value < 1) return { ok: false, error: 'Must be a whole number ≥ 1.' }
  if (value > LIMITS.maxShares) {
    return { ok: false, error: 'Must be at most 1,000,000,000,000 shares.' }
  }
  return { ok: true, value }
}

export function parsePrice(raw: string, field: 'p0' | 'pm'): ParseResult {
  const text = raw.trim()
  const label = PRICE_LABELS[field]
  if (text === '') {
    return { ok: false, error: `Enter ${label}, e.g. ${field === 'p0' ? '50.00' : '40.00'}.` }
  }
  if (!DECIMAL_RE.test(text)) {
    if (text.includes(',') && LOOKS_GROUPED_RE.test(text)) {
      return { ok: false, error: 'Use a dot for decimals and no thousands separators (e.g. 1234.56).' }
    }
    return { ok: false, error: 'Must be a positive number, such as 50.00.' }
  }
  const value = Number(text)
  if (!(value > 0)) return { ok: false, error: 'Must be a positive number greater than 0.' }
  if (value > LIMITS.maxPrice) {
    return { ok: false, error: 'Must be at most $1,000,000,000 per share.' }
  }
  return { ok: true, value }
}

export function parseField(field: Field, raw: string): ParseResult {
  return field === 'q0' ? parseShares(raw) : parsePrice(raw, field)
}

/** Every field's error (whether or not the field has been touched). */
export function computeAllErrors(raw: RawInputs): FieldErrors {
  const errors: FieldErrors = {}
  for (const field of FIELDS) {
    const result = parseField(field, raw[field])
    if (!result.ok) errors[field] = result.error
  }
  return errors
}

/** Errors for touched fields only — the original's `visible_errors/2`. */
export function visibleErrors(raw: RawInputs, touched: Partial<Record<Field, boolean>>): FieldErrors {
  const all = computeAllErrors(raw)
  const visible: FieldErrors = {}
  for (const field of FIELDS) {
    if (touched[field] && all[field]) visible[field] = all[field]
  }
  return visible
}

/** Parsed values when all three fields are valid, otherwise null. */
export function parseValidInputs(raw: RawInputs): ValidInputs | null {
  const q0 = parseShares(raw.q0)
  const p0 = parsePrice(raw.p0, 'p0')
  const pm = parsePrice(raw.pm, 'pm')
  if (!q0.ok || !p0.ok || !pm.ok) return null
  return { q0: q0.value, p0: p0.value, pm: pm.value }
}
