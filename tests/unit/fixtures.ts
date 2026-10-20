/**
 * Typed access to tests/fixtures/elixir-reference.json — values exported from
 * the original Elixir implementation by scripts/export-elixir-reference.exs.
 */
import data from '../fixtures/elixir-reference.json'

export interface ElixirPoint {
  capital: number
  capital_actual: number
  delta: number
  new_average: number
  shares: number
  efficiency_per_100: number
}

export interface ElixirSimResult {
  capital: number
  capital_actual: number
  shares_additional: number
  new_average: number
  delta: number
  delta_max: number
  delta_pct: number
  efficiency: number
  efficiency_per_100: number
  is_averaging_up: boolean
  is_averaging_flat: boolean
  pct_of_max: number
}

export interface ElixirScenario {
  name: string
  raw: { q0: string; p0: string; pm: string }
  parsed: { q0: number; p0: number; pm: number }
  slider_max: number
  delta_max: number
  points: ElixirPoint[]
  sims: { input_capital: number; capital: number; result: ElixirSimResult }[]
  chart: {
    y_min: number
    y_max: number
    y_range: number
    asymptote_y: number
    svg_path: string
    area_path: string
    x_ticks: { val: number; x: number; label: string }[]
    y_ticks: { val: number; y: number; label: string }[]
    asymptote_label: string
    slider_max_label: string
  }
}

export interface ElixirReference {
  scenarios: ElixirScenario[]
  formatters: {
    format_capital: { val: number; label: string }[]
    format_delta: { val: number; label: string }[]
  }
}

export const reference = data as ElixirReference

/**
 * Closeness check for values that went Decimal → float on both sides. The
 * default tolerance is zero: the port currently reproduces every reference
 * value bit for bit.
 */
export function expectClose(actual: number, expected: number, rel = 0): boolean {
  if (actual === expected) return true
  const scale = Math.max(Math.abs(actual), Math.abs(expected), 1e-300)
  return Math.abs(actual - expected) / scale <= rel
}
