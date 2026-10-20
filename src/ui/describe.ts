/** Plain-language summaries of the current result, for screen readers. */
import { formatMoney, formatPercentOfMax, formatPrice, formatShares } from '../lib/format'
import type { State } from '../state/store'

const sharesText = (n: number) => `${formatShares(n)} ${n === 1 ? 'share' : 'shares'}`

/** Short announcement after the inputs or the amount settle. */
export function summarize(state: State): string {
  const { inputs, curve, result } = state
  if (!inputs || !curve || !result) return ''

  if (result.isAveragingUp) {
    if (state.capital <= 0 || result.sharesAdditional === 0) {
      return `Averaging up: the current price ${formatPrice(inputs.pm)} is above your average buy price ${formatPrice(inputs.p0)}, so buying more raises your average.`
    }
    return `Averaging up: ${sharesText(result.sharesAdditional)} for ${formatMoney(result.capitalActual)} raise your average to ${formatPrice(result.newAverage)}, ${formatPrice(-result.delta)} higher.`
  }
  if (result.isAveragingFlat) {
    return `The current price equals your average buy price, so your average stays at ${formatPrice(inputs.p0)}.`
  }
  if (state.capital <= 0) {
    return `Curve ready. Your average can improve by at most ${formatPrice(curve.deltaMax)} per share. Choose an amount to invest.`
  }
  if (result.sharesAdditional === 0) {
    return `${formatMoney(state.capital)} is not enough for one share at ${formatPrice(inputs.pm)}.`
  }
  return `${sharesText(result.sharesAdditional)} for ${formatMoney(result.capitalActual)}: new average ${formatPrice(result.newAverage)}, ${formatPrice(result.delta)} lower, ${formatPercentOfMax(result.pctOfMax)} of the maximum improvement.`
}

/** Longer description of the chart for its accessible name. */
export function describeChart(state: State): string {
  const { inputs, curve, result } = state
  if (!inputs || !curve || !result) return 'Enter your position to see the curve.'

  const range = `capital from $0 to ${formatMoney(curve.sliderMax, 0)}`
  let text: string
  if (result.isAveragingUp) {
    text = `The curve falls below zero across ${range}: buying at ${formatPrice(inputs.pm)} raises your ${formatPrice(inputs.p0)} average, toward a limit of ${formatPrice(curve.deltaMax)}.`
  } else if (curve.deltaMax === 0) {
    text = `The curve stays flat at zero across ${range}, because the current price equals your average buy price.`
  } else {
    text = `The curve rises steeply and then flattens across ${range}. The dashed line marks the maximum possible improvement of ${formatPrice(curve.deltaMax)} per share, which would bring your average down to the current price of ${formatPrice(inputs.pm)}.`
  }
  if (state.capital > 0) {
    text += ` Marker at ${formatMoney(state.capital)}: ${sharesText(result.sharesAdditional)}, new average ${formatPrice(result.newAverage)}.`
  }
  return text
}
