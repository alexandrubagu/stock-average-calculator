/**
 * Wires the DOM views to the store. Every change goes through `update`, which
 * re-renders all views from the same state, so the chart, slider, stats and
 * table always show the same numbers.
 */
import { sliderStep } from '../lib/calculator'
import {
  EXAMPLE,
  blur,
  initialState,
  input,
  load,
  setCapital,
  sliderMaxOf,
  type State,
} from '../state/store'
import { createCapitalControls, type CapitalSource } from './capital'
import { createChart } from './chart'
import { summarize } from './describe'
import { byId } from './dom'
import { createForm } from './form'
import { createResults } from './results'
import { createUrlSync, readUrlState } from './url-state'

const ANNOUNCE_DELAY = 700

export function startApp(): void {
  let state: State = initialState()
  const announcer = byId('announcer')
  const syncUrl = createUrlSync()
  let announceTimer: ReturnType<typeof setTimeout> | undefined

  const form = createForm({
    onInput: (field, value) => update(input(state, field, value), 'other', true),
    onBlur: (field) => update(blur(state, field), 'other', false),
    onExample: () => update(load(state, EXAMPLE.raw, EXAMPLE.capital), 'other', true),
    onReset: () => {
      update(initialState(), 'other', false)
      form.focusFirst()
    },
  })
  const capital = createCapitalControls((value, source, done) => update(setCapital(state, value), source, done))
  const results = createResults()
  const chart = createChart(byId('chart'), (value, done) => {
    // Snap to the slider's step so the chart and the slider agree.
    const max = sliderMaxOf(state)
    const step = sliderStep(max)
    update(setCapital(state, Math.min(max, Math.round(value / step) * step)), 'chart', done)
  })

  function update(next: State, source: CapitalSource, announce: boolean): void {
    state = next
    form.render(state)
    results.render(state)
    capital.render(state, source)
    chart.render(state)
    syncUrl(state)
    if (announce) scheduleAnnouncement()
  }

  function scheduleAnnouncement(): void {
    clearTimeout(announceTimer)
    announceTimer = setTimeout(() => {
      announcer.textContent = summarize(state)
    }, ANNOUNCE_DELAY)
  }

  const fromUrl = readUrlState(window.location.search)
  update(fromUrl ? load(state, fromUrl.raw, fromUrl.capital) : state, 'other', false)
}
