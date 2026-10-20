/**
 * Display formatting. Precision follows the original (2 decimals for money,
 * 0 for the capital card, 4 for efficiency, k/M abbreviations for axis
 * capital), but output is consistent en-US currency with grouping separators.
 */

const moneyFormatters = new Map<string, Intl.NumberFormat>()

function moneyFormatter(minDecimals: number, maxDecimals: number): Intl.NumberFormat {
  const key = `${minDecimals}:${maxDecimals}`
  let formatter = moneyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    })
    moneyFormatters.set(key, formatter)
  }
  return formatter
}

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Fixed-decimal currency, e.g. formatMoney(4026, 2) → "$4,026.00". */
export function formatMoney(value: number, decimals = 2): string {
  return moneyFormatter(decimals, decimals).format(normalizeZero(value))
}

/**
 * A per-share price or price difference. Two decimals from $1 up; below $1,
 * enough decimals to show about three significant digits, so penny-stock
 * values don't collapse to "$0.00".
 */
export function formatPrice(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1 || abs === 0) return formatMoney(value, 2)
  const decimals = Math.min(8, Math.max(2, Math.ceil(-Math.log10(abs)) + 3))
  return moneyFormatter(2, decimals).format(normalizeZero(value))
}

/** Amount actually spent; whole dollars from $100 up, like the original card. */
export function formatCapitalAmount(value: number): string {
  return formatMoney(value, Math.abs(value) >= 100 ? 0 : 2)
}

export function formatShares(value: number): string {
  return integerFormatter.format(value)
}

/**
 * Marginal efficiency as "% change of the average per $100", four decimals.
 * `efficiencyPer100` is E(C) × 100; the displayed percentage is ×100 again.
 */
export function formatEfficiency(efficiencyPer100: number): string {
  return `${(efficiencyPer100 * 100).toFixed(4)}%`
}

/** "50%" from 0.5 — rounded half away from zero like Elixir's round/1. */
export function formatPercentOfMax(pctOfMax: number): string {
  return `${roundHalfAwayFromZero(pctOfMax * 100)}%`
}

/**
 * Compact capital for axis labels: $500, $1.4k, $14k, $1.2M, $3.5B.
 *
 * Same thresholds and rounding as the original `format_capital/1`, except:
 * values that round up to the next unit move to it ($999,999 → "$1.0M", not
 * "$1000k"), billions get a "B" suffix instead of "$2.5e3M", and amounts
 * under $10 keep up to two decimals so small ranges don't repeat labels.
 */
export function formatCapitalTick(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  // toFixed rounds the exact binary value with ties up, like Float.round/2.
  const oneDecimal = (v: number) => v.toFixed(1)

  if (abs >= 1e9 || Number(oneDecimal(abs / 1e6)) >= 1000) return `${sign}$${oneDecimal(abs / 1e9)}B`
  if (abs >= 1e6 || Math.round(abs / 1e3) >= 1000) return `${sign}$${oneDecimal(abs / 1e6)}M`
  if (abs >= 1e4) return `${sign}$${Math.round(abs / 1e3)}k`
  if (abs >= 1e3 || Math.round(abs) >= 1000) return `${sign}$${oneDecimal(abs / 1e3)}k`
  if (abs >= 10) return `${sign}$${Math.round(abs)}`
  return `${sign}$${trimZeros(abs.toFixed(2))}`
}

/**
 * Y-axis labels. The original rounded each value on its own (≥100 → 0,
 * ≥10 → 1, else 2 decimals), which repeats labels on small ranges (six
 * "$0.0" ticks for a penny stock). Here the decimals follow the tick step so
 * neighbouring labels always differ, using the original's thresholds for
 * steps of a dollar or more.
 */
export function formatDeltaTick(value: number, step: number): string {
  const absStep = Math.abs(step)
  let decimals: number
  if (absStep >= 100) decimals = 0
  else if (absStep >= 1) decimals = 1
  else if (absStep > 0) decimals = Math.min(6, Math.ceil(-Math.log10(absStep)) + 1)
  else decimals = 2
  if (Math.abs(value) >= 100 && absStep >= 10) decimals = 0
  return moneyFormatter(decimals, decimals).format(normalizeZero(value))
}

export function roundHalfAwayFromZero(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value))
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

/** Avoids "-$0.00" for negative zero or values that round to zero. */
function normalizeZero(value: number): number {
  return Object.is(value, -0) ? 0 : value
}
