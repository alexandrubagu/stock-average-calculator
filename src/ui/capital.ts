/**
 * Capital controls: the range slider (as in the original), plus an exact
 * amount field. Both feed the same store value.
 */
import { sliderStep } from '../lib/calculator'
import { formatCapitalTick, formatMoney, formatPercentOfMax, formatPrice, formatShares } from '../lib/format'
import { sliderMaxOf, type State } from '../state/store'
import { byId, setText } from './dom'

export type CapitalSource = 'slider' | 'amount' | 'chart' | 'other'

export interface CapitalView {
  render(state: State, source: CapitalSource): void
}

const AMOUNT_RE = /^(?:\d+\.?\d*|\.\d+)$/

/** Parses "2,500", "$2500.50" or "" (zero); returns null for anything else. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '')
  if (cleaned === '') return 0
  return AMOUNT_RE.test(cleaned) ? Number(cleaned) : null
}

export function createCapitalControls(
  onCapital: (capital: number, source: CapitalSource, done: boolean) => void,
): CapitalView {
  const panel = byId('capital-panel')
  const slider = byId<HTMLInputElement>('capital-slider')
  const display = byId('capital-display')
  const pct = byId('capital-pct')
  const mid = byId('slider-mid')
  const max = byId('slider-max')
  const amount = byId<HTMLInputElement>('capital-amount')
  const note = byId('capital-amount-note')

  // Last value typed into the amount field, to explain clamping.
  let requested: number | null = null
  let invalidAmount = false

  slider.addEventListener('input', () => {
    requested = null
    onCapital(Number(slider.value), 'slider', false)
  })
  slider.addEventListener('change', () => onCapital(Number(slider.value), 'slider', true))

  // Android Chrome can open the keyboard when a range input gets focus on touch
  // (the original hook works around this the same way).
  slider.addEventListener(
    'touchstart',
    () => {
      requestAnimationFrame(() => {
        if (document.activeElement === slider && matchMedia('(pointer: coarse)').matches) slider.blur()
      })
    },
    { passive: true },
  )

  amount.addEventListener('input', () => {
    const value = parseAmount(amount.value)
    invalidAmount = value === null
    if (value === null) {
      setText(note, 'Enter an amount in dollars, for example 2500.')
      return
    }
    requested = value
    onCapital(value, 'amount', false)
  })
  amount.addEventListener('change', () => {
    if (!invalidAmount) onCapital(requested ?? 0, 'amount', true)
  })

  return {
    render(state, source) {
      const { curve, result, inputs } = state
      panel.hidden = !curve
      if (!curve || !result || !inputs) return

      const sliderMax = sliderMaxOf(state)
      const maxText = String(sliderMax)
      if (slider.max !== maxText) {
        slider.max = maxText
        slider.step = String(sliderStep(sliderMax))
      }
      if (source !== 'slider') slider.value = String(state.capital)
      slider.style.setProperty('--fill', `${((state.capital / sliderMax) * 100).toFixed(2)}%`)
      slider.setAttribute(
        'aria-valuetext',
        state.capital > 0
          ? `${formatMoney(state.capital)} — ${formatShares(result.sharesAdditional)} shares, new average ${formatPrice(result.newAverage)}`
          : '$0, nothing invested',
      )

      setText(display, formatMoney(result.capitalActual))
      setText(pct, capitalCaption(state))
      setText(
        mid,
        curve.deltaMax > 0 ? `← 90% of max at ${formatCapitalTick(sliderMax)}` : `10× your position's cost`,
      )
      setText(max, formatCapitalTick(sliderMax))

      if (source !== 'amount') {
        requested = null
        invalidAmount = false
        const text = state.capital > 0 ? String(Math.round(state.capital * 100) / 100) : ''
        if (amount.value !== text) amount.value = text
      }
      if (!invalidAmount) setText(note, amountNote(state, requested))
    },
  }
}

/** Caption under the amount. The original printed "0% of max improvement" when averaging up. */
function capitalCaption(state: State): string {
  const { result } = state
  if (!result || state.capital <= 0) return ' '
  if (result.isAveragingUp) return result.sharesAdditional > 0 ? 'raises your average' : ' '
  return `${formatPercentOfMax(result.pctOfMax)} of max improvement`
}

/**
 * Explains a typed amount (capped, too small, or not fully invested). Shown
 * only for typed amounts: while dragging, a note that comes and goes would
 * make the cards below jump, and the Capital card already says what is spent.
 */
function amountNote(state: State, requested: number | null): string {
  const { result, inputs, curve } = state
  if (!result || !inputs || !curve || requested === null) return ''
  if (requested > curve.sliderMax) {
    const reason = curve.deltaMax > 0 ? '90% of the maximum improvement' : "10× your position's cost"
    return `Capped at ${formatMoney(curve.sliderMax)}, where the slider ends (${reason}).`
  }
  if (state.capital <= 0) return ''
  if (result.sharesAdditional === 0) return `Not enough for one share at ${formatPrice(inputs.pm)}.`
  const leftover = state.capital - result.capitalActual
  if (leftover < 0.005) return ''
  const shares = `${formatShares(result.sharesAdditional)} whole ${result.sharesAdditional === 1 ? 'share costs' : 'shares cost'}`
  return `${shares} ${formatMoney(result.capitalActual)}; ${formatMoney(leftover)} stays uninvested.`
}
