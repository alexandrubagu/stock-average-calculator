/**
 * Notices, stat cards and the data table. Display rules follow the original
 * server-rendered template (simulator_live.html.heex).
 */
import { computeSimResult, type CurvePayload } from '../lib/calculator'
import {
  formatCapitalAmount,
  formatEfficiency,
  formatMoney,
  formatPercentOfMax,
  formatPrice,
  formatShares,
} from '../lib/format'
import type { State } from '../state/store'
import { byId, escapeXml, setText } from './dom'

export interface ResultsView {
  render(state: State): void
}

const DASH = '—'

export function createResults(): ResultsView {
  const upNotice = byId('notice-averaging-up')
  const upText = byId('notice-averaging-up-text')
  const flatNotice = byId('notice-flat')
  const flatText = byId('notice-flat-text')
  const stats = byId('stats')
  const table = byId<HTMLDetailsElement>('data-table')
  const tableBody = byId('data-table-body')
  const el = {
    newAvgCard: byId('stat-new-avg-card'),
    newAvg: byId('stat-new-avg'),
    newAvgSub: byId('stat-new-avg-sub'),
    deltaCard: byId('stat-delta-card'),
    delta: byId('stat-delta'),
    deltaSub: byId('stat-delta-sub'),
    capital: byId('stat-capital'),
    capitalSub: byId('stat-capital-sub'),
    shares: byId('stat-shares'),
    sharesSub: byId('stat-shares-sub'),
    efficiency: byId('stat-efficiency'),
    efficiencySub: byId('stat-efficiency-sub'),
  }
  let tableCurve: CurvePayload | null = null

  return {
    render(state) {
      const { inputs, curve, result } = state

      // Notices
      const averagingUp = Boolean(result?.isAveragingUp)
      upNotice.hidden = !averagingUp
      if (averagingUp && inputs) {
        setText(
          upText,
          `The current price (${formatPrice(inputs.pm)}) is above your average buy price (${formatPrice(inputs.p0)}). Buying more will raise your average cost.`,
        )
      }
      const flat = Boolean(result?.isAveragingFlat) && !averagingUp
      flatNotice.hidden = !flat
      if (flat && inputs) {
        setText(
          flatText,
          `The current price equals your average buy price, so buying more shares leaves your average at ${formatPrice(inputs.p0)}.`,
        )
      }

      stats.hidden = !curve
      table.hidden = !curve
      if (!curve || !result || !inputs) {
        tableCurve = null
        return
      }

      // Stat cards
      const active = state.capital > 0
      const improving = active && result.delta > 0 && !result.isAveragingUp
      const raising = active && result.isAveragingUp

      el.newAvgCard.classList.toggle('is-positive', improving)
      el.newAvgCard.classList.toggle('is-warning', raising)
      setText(el.newAvg, active ? formatPrice(result.newAverage) : DASH)
      setText(
        el.newAvgSub,
        improving ? `was ${formatPrice(inputs.p0)}` : raising && result.sharesAdditional > 0 ? `up from ${formatPrice(inputs.p0)}` : '',
      )

      el.delta.classList.toggle('is-positive', improving)
      setText(el.delta, improving ? formatPrice(result.delta) : DASH)
      setText(
        el.deltaSub,
        improving ? `${formatPercentOfMax(result.pctOfMax)} of max` : raising ? 'none — averaging up' : '',
      )

      setText(el.capital, active ? formatCapitalAmount(result.capitalActual) : DASH)
      setText(
        el.capitalSub,
        active && result.sharesAdditional > 0
          ? `for ${formatShares(result.sharesAdditional)} ${result.sharesAdditional === 1 ? 'share' : 'shares'}`
          : '',
      )

      setText(el.shares, active ? formatShares(result.sharesAdditional) : DASH)
      setText(el.sharesSub, active ? `at ${formatPrice(inputs.pm)} each` : '')

      setText(el.efficiency, active ? formatEfficiency(result.efficiencyPer100) : DASH)
      setText(el.efficiencySub, active ? 'avg change per $100' : '')

      // Data table: rebuilt only when the curve changes.
      if (tableCurve !== curve) {
        tableCurve = curve
        tableBody.innerHTML = tableRows(state, curve)
      }
    },
  }
}

function tableRows(state: State, curve: CurvePayload): string {
  const { inputs } = state
  if (!inputs) return ''
  const rows: string[] = []
  const steps = 5
  for (let i = 0; i <= steps; i++) {
    const amount = (i / steps) * curve.sliderMax
    const r = computeSimResult(inputs.q0, inputs.p0, inputs.pm, amount)
    const cells = [
      formatMoney(amount, amount >= 100 ? 0 : 2),
      formatShares(r.sharesAdditional),
      formatCapitalAmount(r.capitalActual),
      formatPrice(r.newAverage),
      formatPrice(r.delta),
      curve.deltaMax > 0 ? formatPercentOfMax(r.pctOfMax) : DASH,
    ]
    rows.push(`<tr>${cells.map((cell) => `<td>${escapeXml(cell)}</td>`).join('')}</tr>`)
  }
  return rows.join('')
}
