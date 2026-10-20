/**
 * Light/dark theme. Follows the operating system until the visitor picks a
 * theme with the toggle; that choice is remembered in localStorage.
 */
type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const THEME_COLORS: Record<Theme, string> = { light: '#f8fafc', dark: '#0b1120' }

export function initTheme(button: HTMLButtonElement | null): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  apply(readStored() ?? (media.matches ? 'dark' : 'light'))

  media.addEventListener('change', (event) => {
    if (!readStored()) apply(event.matches ? 'dark' : 'light')
  })

  button?.addEventListener('click', () => {
    const next: Theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    apply(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page view.
    }
  })

  function apply(theme: Theme): void {
    document.documentElement.dataset.theme = theme
    button?.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme')
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.setAttribute('content', THEME_COLORS[theme])
    }
  }
}

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}
