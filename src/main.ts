import './styles/main.css'
import { startApp } from './ui/app'
import { initTheme } from './ui/theme'
import { createTour, hasSeenTour } from './ui/tour'

const FIRST_VISIT_DELAY = 500

initTheme(document.querySelector<HTMLButtonElement>('#theme-toggle'))
const app = startApp()
const tour = createTour(app)

document.querySelector('#tour-button')?.addEventListener('click', () => tour.start('button'))

// First visit: show the tour, unless the page was opened from a shared scenario.
if (!app.openedWithScenario && !hasSeenTour()) {
  setTimeout(() => tour.start('auto'), FIRST_VISIT_DELAY)
}
