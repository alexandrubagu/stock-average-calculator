/**
 * Guided tour. It fills in an example position, moves the slider and points
 * at each result, then puts the calculator back the way it was.
 *
 * Starts automatically on a first visit (unless the page was opened with a
 * scenario in the URL) and again from the "How it works" button. Every step
 * describes its own calculator state, so Back, Next and Skip work at any
 * moment, including in the middle of an animation.
 */
import { buildCurvePayload, computeSimResult } from '../lib/calculator'
import { formatMoney, formatPercentOfMax, formatPrice, formatShares } from '../lib/format'
import type { Field, RawInputs } from '../lib/validation'
import { EXAMPLE, input, load, setCapital, type State } from '../state/store'

export interface TourHost {
  getState(): State
  /** Shows a state without announcing it or writing it to the URL. */
  preview(next: State): void
  /** Shows a state and writes it to the URL. */
  show(next: State): void
  focusFirstField(): void
}

export interface Tour {
  start(origin: 'auto' | 'button'): void
}

type Placement = 'right' | 'bottom' | 'top'
type Action = { type: Field; text: string } | { slideTo: number }

interface Step {
  target: string
  title: string
  body: string
  placements: Placement[]
  /** Calculator state shown when the step starts. */
  raw: RawInputs
  capital: number
  /** Animation played after the starting state is shown. */
  action?: Action
}

const STORAGE_KEY = 'tour-seen'
const GAP = 12
const SPOTLIGHT_PADDING = 6
const TYPE_DELAY = 140
const SLIDE_DURATION = 1400
const ACTION_DELAY = 400

/** True once the tour has been finished or skipped (or storage is unavailable). */
export function hasSeenTour(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Storage unavailable: the tour simply won't be remembered.
  }
}

function buildSteps(): Step[] {
  const raw = EXAMPLE.raw
  const q0 = Number(raw.q0)
  const p0 = Number(raw.p0)
  const pm = Number(raw.pm)
  const sliderMax = buildCurvePayload(q0, p0, pm).sliderMax
  const first = computeSimResult(q0, p0, pm, EXAMPLE.capital)
  const last = computeSimResult(q0, p0, pm, sliderMax)
  const empty: RawInputs = { q0: '', p0: '', pm: '' }
  const inputPlacements: Placement[] = ['right', 'bottom', 'top']
  const blockPlacements: Placement[] = ['bottom', 'top', 'right']

  return [
    {
      target: '.field[data-field="q0"]',
      title: 'Shares held',
      body: `Start with the number of shares you own now — in this example, ${formatShares(q0)}.`,
      placements: inputPlacements,
      raw: empty,
      capital: 0,
      action: { type: 'q0', text: raw.q0 },
    },
    {
      target: '.field[data-field="p0"]',
      title: 'Average buy price',
      body: `What you paid per share on average: your cost basis. Here, ${formatPrice(p0)}.`,
      placements: inputPlacements,
      raw: { ...empty, q0: raw.q0 },
      capital: 0,
      action: { type: 'p0', text: raw.p0 },
    },
    {
      target: '.field[data-field="pm"]',
      title: 'Current price',
      body: `Today's price, which is what every new share costs. Here, ${formatPrice(pm)}. Once all three fields are filled in, the curve appears.`,
      placements: inputPlacements,
      raw: { ...raw, pm: '' },
      capital: 0,
      action: { type: 'pm', text: raw.pm },
    },
    {
      target: '.chart-card',
      title: 'The curve',
      body: `How much your average improves for every amount you invest. It rises steeply, then flattens. The dashed line is the limit: your average can get close to ${formatPrice(pm)} but never reach it.`,
      placements: blockPlacements,
      raw,
      capital: 0,
    },
    {
      target: '#capital-panel',
      title: 'Choose an amount',
      body: `Drag the slider, tap the chart or type an amount. Here, ${formatMoney(EXAMPLE.capital, 0)}: enough for ${formatShares(first.sharesAdditional)} more shares at ${formatPrice(pm)}.`,
      placements: blockPlacements,
      raw,
      capital: 0,
      action: { slideTo: EXAMPLE.capital },
    },
    {
      target: '#stats',
      title: 'Read the result',
      body: `Your new average is ${formatPrice(first.newAverage)}, ${formatPrice(first.delta)} lower than before: ${formatPercentOfMax(first.pctOfMax)} of the maximum possible improvement.`,
      placements: blockPlacements,
      raw,
      capital: EXAMPLE.capital,
    },
    {
      target: '.chart-card',
      title: 'Diminishing returns',
      body: `Now invest ${formatMoney(sliderMax, 0)}, ${Math.round(sliderMax / EXAMPLE.capital)} times as much. Your average only reaches ${formatPrice(last.newAverage)}, ${formatPercentOfMax(last.pctOfMax)} of the maximum. Every extra dollar helps less than the one before.`,
      placements: blockPlacements,
      raw,
      capital: EXAMPLE.capital,
      action: { slideTo: sliderMax },
    },
    {
      target: '#tour-button',
      title: 'Your turn',
      body: 'Closing the tour removes the example so you can enter your own position. Replay it any time with “How it works”.',
      placements: inputPlacements,
      raw,
      capital: sliderMax,
    },
  ]
}

export function createTour(host: TourHost): Tour {
  const steps = buildSteps()
  let index = 0
  let run = 0
  let frame = 0
  let snapshot: State | null = null
  let origin: 'auto' | 'button' = 'auto'
  let elements: TourElements | null = null
  let inerted: HTMLElement[] = []

  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function start(from: 'auto' | 'button'): void {
    if (elements) return
    origin = from
    snapshot = host.getState()
    elements = mount()
    inerted = [...document.querySelectorAll<HTMLElement>('body > header, body > main, body > footer, body > .skip-link')]
    for (const element of inerted) element.inert = true
    document.addEventListener('keydown', onKeydown)
    window.addEventListener('resize', schedulePlacement)
    show(0)
  }

  function end(): void {
    if (!elements) return
    run++
    cancelAnimationFrame(frame)
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('resize', schedulePlacement)
    elements.root.remove()
    elements = null
    for (const element of inerted) element.inert = false
    inerted = []
    markSeen()
    if (snapshot) host.show(snapshot)
    snapshot = null
    if (origin === 'button') document.getElementById('tour-button')?.focus()
    else if (window.matchMedia('(pointer: fine)').matches) host.focusFirstField()
  }

  function show(next: number): void {
    if (!elements) return
    index = next
    const step = steps[index]
    const token = ++run

    host.preview(load(host.getState(), step.raw, step.capital))

    const { progress, title, body, back, nextButton, live } = elements
    progress.textContent = `Step ${index + 1} of ${steps.length}`
    title.textContent = step.title
    body.textContent = step.body
    back.hidden = index === 0
    nextButton.textContent = index === steps.length - 1 ? 'Finish' : 'Next'
    live.textContent = `Step ${index + 1} of ${steps.length}. ${step.title}. ${step.body}`
    elements.popover.classList.toggle('is-docked', docked())

    scrollIntoView(step)
    follow()
    nextButton.focus({ preventScroll: true })

    if (step.action) void play(step.action, token)
  }

  async function play(action: Action, token: number): Promise<void> {
    const animate = !reducedMotion()
    if (animate) await wait(ACTION_DELAY)
    if (token !== run) return

    if ('type' in action) {
      const chars = animate ? action.text.length : 1
      for (let i = 1; i <= chars; i++) {
        const text = animate ? action.text.slice(0, i) : action.text
        host.preview(input(host.getState(), action.type, text))
        if (animate && i < chars) await wait(TYPE_DELAY)
        if (token !== run) return
      }
      return
    }

    const from = host.getState().capital
    const to = action.slideTo
    if (!animate) {
      host.preview(setCapital(host.getState(), to))
      return
    }
    const startTime = performance.now()
    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        if (token !== run) return resolve()
        const t = Math.min(1, (now - startTime) / SLIDE_DURATION)
        const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
        host.preview(setCapital(host.getState(), t === 1 ? to : from + (to - from) * eased))
        if (t < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      end()
    }
  }

  function next(): void {
    if (index === steps.length - 1) end()
    else show(index + 1)
  }

  function back(): void {
    if (index > 0) show(index - 1)
  }

  /** Keeps the spotlight and popover on the target while the page changes. */
  function follow(): void {
    cancelAnimationFrame(frame)
    const loop = () => {
      place()
      frame = requestAnimationFrame(loop)
    }
    loop()
  }

  function schedulePlacement(): void {
    if (elements) scrollIntoView(steps[index])
  }

  function target(step: Step): HTMLElement | null {
    return document.querySelector<HTMLElement>(step.target)
  }

  function docked(): boolean {
    return window.innerWidth < 640
  }

  function scrollIntoView(step: Step): void {
    const element = target(step)
    if (!element || !elements) return
    const rect = element.getBoundingClientRect()
    const header = document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0
    const top = header + 16
    const bottom = window.innerHeight - (docked() ? elements.popover.offsetHeight + 2 * GAP : 16)
    if (rect.top < top || rect.bottom > bottom) {
      window.scrollBy({ top: rect.top - top, behavior: 'instant' })
    }
  }

  function place(): void {
    if (!elements) return
    const step = steps[index]
    const element = target(step)
    const { spotlight, popover } = elements
    if (!element) return

    const rect = element.getBoundingClientRect()
    spotlight.style.top = `${rect.top - SPOTLIGHT_PADDING}px`
    spotlight.style.left = `${rect.left - SPOTLIGHT_PADDING}px`
    spotlight.style.width = `${rect.width + 2 * SPOTLIGHT_PADDING}px`
    spotlight.style.height = `${rect.height + 2 * SPOTLIGHT_PADDING}px`

    popover.classList.toggle('is-docked', docked())
    if (docked()) {
      popover.style.top = ''
      popover.style.left = ''
      return
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = popover.offsetWidth
    const height = popover.offsetHeight
    const clampX = (x: number) => Math.min(Math.max(x, GAP), vw - width - GAP)
    const clampY = (y: number) => Math.min(Math.max(y, GAP), vh - height - GAP)
    const space: Record<Placement, boolean> = {
      right: rect.right + SPOTLIGHT_PADDING + GAP + width <= vw - GAP,
      bottom: rect.bottom + SPOTLIGHT_PADDING + GAP + height <= vh - GAP,
      top: rect.top - SPOTLIGHT_PADDING - GAP - height >= GAP,
    }
    const placement = step.placements.find((p) => space[p])
    let x: number
    let y: number
    if (placement === 'right') {
      x = rect.right + SPOTLIGHT_PADDING + GAP
      y = clampY(rect.top)
    } else if (placement === 'bottom') {
      x = clampX(rect.left)
      y = rect.bottom + SPOTLIGHT_PADDING + GAP
    } else if (placement === 'top') {
      x = clampX(rect.left)
      y = rect.top - SPOTLIGHT_PADDING - GAP - height
    } else {
      // Nothing fits next to the target: keep the popover inside the viewport.
      x = clampX(rect.left)
      y = vh - height - GAP
    }
    popover.style.left = `${Math.round(x)}px`
    popover.style.top = `${Math.round(y)}px`
  }

  function mount(): TourElements {
    const root = document.createElement('div')
    root.className = 'tour'
    root.innerHTML = `
      <div class="tour-backdrop"></div>
      <div class="tour-spotlight" aria-hidden="true"></div>
      <div class="tour-popover" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
        <p class="tour-progress" id="tour-progress"></p>
        <h2 class="tour-title" id="tour-title"></h2>
        <p class="tour-body" id="tour-body"></p>
        <div class="tour-actions">
          <button type="button" class="tour-skip">Skip tour</button>
          <button type="button" class="button button-ghost tour-back">Back</button>
          <button type="button" class="button button-secondary tour-next">Next</button>
        </div>
        <p class="visually-hidden" aria-live="polite"></p>
      </div>`
    document.body.append(root)

    const q = <T extends Element>(selector: string) => root.querySelector(selector) as T
    const result: TourElements = {
      root,
      spotlight: q('.tour-spotlight'),
      popover: q('.tour-popover'),
      progress: q('.tour-progress'),
      title: q('.tour-title'),
      body: q('.tour-body'),
      back: q('.tour-back'),
      nextButton: q('.tour-next'),
      live: q('[aria-live]'),
    }
    q<HTMLButtonElement>('.tour-skip').addEventListener('click', end)
    result.back.addEventListener('click', back)
    result.nextButton.addEventListener('click', next)
    return result
  }

  return { start }
}

interface TourElements {
  root: HTMLDivElement
  spotlight: HTMLDivElement
  popover: HTMLDivElement
  progress: HTMLParagraphElement
  title: HTMLHeadingElement
  body: HTMLParagraphElement
  back: HTMLButtonElement
  nextButton: HTMLButtonElement
  live: HTMLParagraphElement
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
