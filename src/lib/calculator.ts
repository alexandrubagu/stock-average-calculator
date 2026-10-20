/**
 * Financial math for the averaging-down simulator.
 *
 * This is a 1:1 port of the original `Avgr.Calculator` (Elixir). Every
 * operation uses Decimal with the same precision, rounding mode and operation
 * order, and results are converted to JS numbers only at the very end, exactly
 * like the original's `Decimal.to_float/1`.
 *
 * Terminology
 *   q0        shares currently held (integer ≥ 1)
 *   p0        current average price / cost basis
 *   pm        current market price
 *   pmEff     effective market price after broker fee: pm × (1 + fee)
 *   capital   additional capital to deploy
 *   delta     reduction in average price = p0 − pNew
 *   deltaMax  maximum possible delta = p0 − pm (the asymptote)
 *
 * Numeric inputs are passed as JS numbers (the parsed form values). Decimal
 * converts a number via its shortest round-trip string, which is what
 * Elixir's `Decimal.from_float/1` does with the parsed floats.
 */
import { Decimal, type DecimalValue } from './decimal'

/** Number of intervals in the pre-computed curve (the curve has 121 points). */
export const CURVE_POINTS = 120

export interface CurvePoint {
  capital: number
  capitalActual: number
  delta: number
  newAverage: number
  shares: number
  efficiencyPer100: number
}

export interface CurvePayload {
  points: CurvePoint[]
  sliderMax: number
  deltaMax: number
}

export interface SimResult {
  capital: number
  capitalActual: number
  sharesAdditional: number
  newAverage: number
  delta: number
  deltaMax: number
  deltaPct: number
  efficiency: number
  efficiencyPer100: number
  isAveragingUp: boolean
  isAveragingFlat: boolean
  pctOfMax: number
}

const ZERO = new Decimal(0)
const ONE = new Decimal(1)
const ONE_TENTH = new Decimal('0.1')
const TEN = new Decimal(10)
const HUNDRED = new Decimal(100)
const FLAT_TOLERANCE = new Decimal('0.0001')

const dec = (value: DecimalValue): Decimal => new Decimal(value)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Full curve for one set of inputs: CURVE_POINTS + 1 evenly spaced points
 * from 0 to `sliderMax`, plus the slider bound and the asymptote.
 */
export function buildCurvePayload(
  q0: number,
  p0: DecimalValue,
  pm: DecimalValue,
  fee: DecimalValue = 0,
): CurvePayload {
  const pmEff = computePmEff(pm, fee)
  const sliderMax = computeSliderMax(q0, p0, pm)
  const deltaMax = computeDeltaMax(p0, pm)
  const points = generateCurvePoints(q0, p0, pmEff, sliderMax)

  return { points, sliderMax: sliderMax.toNumber(), deltaMax: deltaMax.toNumber() }
}

/** Simulation result for a single capital amount. */
export function computeSimResult(
  q0: number,
  p0In: DecimalValue,
  pmIn: DecimalValue,
  capitalIn: DecimalValue,
  fee: DecimalValue = 0,
): SimResult {
  const p0 = dec(p0In)
  const pm = dec(pmIn)
  const capital = dec(capitalIn)
  const pmEff = computePmEff(pm, fee)

  const sharesAdditional = computeSharesToBuy(pmEff, capital)
  const capitalActual = dec(sharesAdditional).times(pmEff)
  const newAverage = computeNewAverage(q0, p0, pmEff, capitalActual)
  const delta = computeDelta(p0, newAverage)
  const deltaMax = computeDeltaMax(p0, pm)
  const deltaPct = p0.gt(ZERO) ? delta.div(p0) : ZERO
  // The original passes the raw market price (not pmEff) here.
  const efficiency = computeEfficiency(q0, p0, pm, capitalActual)
  const pctOfMax = deltaMax.gt(ZERO) ? Decimal.min(delta.div(deltaMax), ONE) : ZERO

  return {
    capital: capital.toNumber(),
    capitalActual: capitalActual.toNumber(),
    sharesAdditional,
    newAverage: newAverage.toNumber(),
    delta: delta.toNumber(),
    deltaMax: deltaMax.toNumber(),
    deltaPct: deltaPct.toNumber(),
    efficiency: efficiency.toNumber(),
    efficiencyPer100: efficiency.times(HUNDRED).toNumber(),
    isAveragingUp: pm.gt(p0),
    isAveragingFlat: pm.minus(p0).abs().lt(FLAT_TOLERANCE),
    pctOfMax: pctOfMax.toNumber(),
  }
}

// ---------------------------------------------------------------------------
// Core math
// ---------------------------------------------------------------------------

/** Effective market price after broker fee: pm × (1 + fee). */
export function computePmEff(pm: DecimalValue, fee: DecimalValue): Decimal {
  return dec(pm).times(ONE.plus(fee))
}

/** New weighted average: (q0·p0 + capital) / (q0 + capital/pmEff). */
export function computeNewAverage(
  q0: number,
  p0: DecimalValue,
  pmEff: DecimalValue,
  capital: DecimalValue,
): Decimal {
  const dq0 = dec(q0)
  const c = dec(capital)
  const sharesNew = c.div(pmEff)
  const totalCost = dq0.times(p0).plus(c)
  const totalShares = dq0.plus(sharesNew)
  return totalCost.div(totalShares)
}

/** delta = p0 − pNew (positive = the average price improved). */
export function computeDelta(p0: DecimalValue, pNew: DecimalValue): Decimal {
  return dec(p0).minus(pNew)
}

/** Maximum achievable delta = p0 − pm (asymptote). */
export function computeDeltaMax(p0: DecimalValue, pm: DecimalValue): Decimal {
  return dec(p0).minus(pm)
}

/**
 * Marginal efficiency at `capital`: |q0·(pm − p0)| / (p0 · pm · (q0 + capital/pm)²).
 *
 * This is the derivative of (delta / p0) with respect to capital — how much
 * the next dollar lowers the average, as a fraction of p0. It is not zero at
 * capital = 0 (the original's zero-capital guard never matches a Decimal).
 */
export function computeEfficiency(
  q0: number,
  p0In: DecimalValue,
  pmIn: DecimalValue,
  capital: DecimalValue,
): Decimal {
  const dq0 = dec(q0)
  const p0 = dec(p0In)
  const pm = dec(pmIn)

  const sharesTotal = dq0.plus(dec(capital).div(pm))
  const numerator = dq0.times(pm.minus(p0)).abs()
  const denominator = p0.times(pm.times(sharesTotal.times(sharesTotal)))

  return denominator.eq(ZERO) ? ZERO : numerator.div(denominator)
}

/** Whole shares that `capital` buys at `pmEff` — always floored. */
export function computeSharesToBuy(pmEff: DecimalValue, capital: DecimalValue): number {
  const price = dec(pmEff)
  if (price.eq(ZERO)) return 0
  return dec(capital).div(price).floor().toNumber()
}

/**
 * Capital needed to reach 90% of deltaMax (the slider's upper bound).
 *
 *   targetAvg  = pm + 0.1·(p0 − pm)
 *   qNeeded    = q0·(p0 − targetAvg) / (targetAvg − pm)
 *   sliderMax  = qNeeded · pm
 *
 * Falls back to 10× the position's cost when pm ≥ p0 (no improvement possible).
 */
export function computeSliderMax(q0: number, p0In: DecimalValue, pmIn: DecimalValue): Decimal {
  const dq0 = dec(q0)
  const p0 = dec(p0In)
  const pm = dec(pmIn)

  const targetAvg = pm.plus(p0.minus(pm).times(ONE_TENTH))
  const numerator = dq0.times(p0.minus(targetAvg))
  const denominator = targetAvg.minus(pm)

  if (denominator.lte(ZERO)) {
    return dq0.times(p0.times(TEN))
  }
  return numerator.div(denominator).times(pm)
}

/** CURVE_POINTS + 1 evenly spaced points from capital 0 to `sliderMax`. */
export function generateCurvePoints(
  q0: number,
  p0: DecimalValue,
  pmEffIn: DecimalValue,
  sliderMaxIn: DecimalValue,
): CurvePoint[] {
  const pmEff = dec(pmEffIn)
  const sliderMax = dec(sliderMaxIn)
  const steps = dec(CURVE_POINTS)
  const points: CurvePoint[] = []

  for (let i = 0; i <= CURVE_POINTS; i++) {
    const capital = dec(i).div(steps).times(sliderMax)
    const shares = computeSharesToBuy(pmEff, capital)
    const capitalActual = dec(shares).times(pmEff)
    const pNew = computeNewAverage(q0, p0, pmEff, capitalActual)
    const delta = computeDelta(p0, pNew)
    const efficiency = computeEfficiency(q0, p0, pmEff, capitalActual)

    points.push({
      capital: capital.toNumber(),
      capitalActual: capitalActual.toNumber(),
      delta: delta.toNumber(),
      newAverage: pNew.toNumber(),
      shares,
      efficiencyPer100: efficiency.times(HUNDRED).toNumber(),
    })
  }

  return points
}

/** Slider granularity used by the original: 500 steps, never below $1. */
export function sliderStep(sliderMax: number): number {
  return Math.max(1, sliderMax / 500)
}
