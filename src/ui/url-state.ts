/**
 * Keeps the scenario in the query string (?q0=100&p0=50&pm=40&c=4000) so it
 * can be bookmarked or shared. Nothing is sent anywhere; the canonical URL in
 * the page head stays query-free.
 */
import type { RawInputs } from '../lib/validation'
import type { State } from '../state/store'

const MAX_LENGTH = 40

export function readUrlState(search: string): { raw: RawInputs; capital: number } | null {
  const params = new URLSearchParams(search)
  if (!params.has('q0') && !params.has('p0') && !params.has('pm')) return null
  const get = (key: string) => (params.get(key) ?? '').trim().slice(0, MAX_LENGTH)
  const capital = Number(get('c'))
  return {
    raw: { q0: get('q0'), p0: get('p0'), pm: get('pm') },
    capital: Number.isFinite(capital) && capital > 0 ? capital : 0,
  }
}

export function urlFor(state: State, location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const params = new URLSearchParams(location.search)
  for (const key of ['q0', 'p0', 'pm'] as const) {
    const value = state.raw[key].trim()
    if (value) params.set(key, value)
    else params.delete(key)
  }
  if (state.curve && state.capital > 0) params.set('c', String(Math.round(state.capital * 100) / 100))
  else params.delete('c')
  const query = params.toString()
  return `${location.pathname}${query ? `?${query}` : ''}${location.hash}`
}

/** Debounced history.replaceState (browsers throttle rapid calls). */
export function createUrlSync(delay = 400): (state: State) => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  return (state) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const next = urlFor(state, window.location)
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (next !== current) {
        try {
          history.replaceState(history.state, '', next)
        } catch {
          // Ignore: some browsers reject replaceState in sandboxed frames.
        }
      }
    }, delay)
  }
}
