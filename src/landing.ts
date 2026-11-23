import './styles/landing.css'

// The web calculator used to live on this page. Send old shared scenarios
// (?q0=…&p0=…&pm=…) and in-page links (#faq, …) to its new home.
const LEGACY_HASHES = new Set(['#calculator', '#how-it-works', '#formulas', '#faq'])
const params = new URLSearchParams(window.location.search)
if (['q0', 'p0', 'pm'].some((key) => params.has(key)) || LEGACY_HASHES.has(window.location.hash)) {
  window.location.replace(new URL(`calculator/${window.location.search}${window.location.hash}`, window.location.href))
} else {
  initCarousel()
}

function initCarousel(): void {
  const track = document.querySelector<HTMLElement>('#track')
  if (!track) return
  const slides = Array.from(track.querySelectorAll<HTMLElement>('.slide'))
  const dots = Array.from(document.querySelectorAll<HTMLButtonElement>('.dots button'))
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const AUTOPLAY_MS = 4000
  let current = 0
  let timer: ReturnType<typeof setInterval> | undefined
  let paused = false

  const go = (index: number) => {
    current = (index + slides.length) % slides.length
    track.scrollTo({ left: current * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' })
  }

  const markCurrent = (index: number) => {
    current = index
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === index)))
    slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)))
  }

  // Keep dots in sync with swipes and programmatic scrolling.
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) markCurrent(slides.indexOf(entry.target as HTMLElement))
      }
    },
    { root: track, threshold: 0.6 },
  )
  slides.forEach((slide) => observer.observe(slide))

  for (const dot of dots) dot.addEventListener('click', () => (stop(), go(Number(dot.dataset.go))))
  for (const arrow of document.querySelectorAll<HTMLButtonElement>('.arrow')) {
    arrow.addEventListener('click', () => (stop(), go(current + Number(arrow.dataset.dir))))
  }
  track.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      stop()
      go(current + (event.key === 'ArrowRight' ? 1 : -1))
    }
  })

  // Autoplay until the visitor interacts; never with reduced motion.
  function start(): void {
    if (paused || reduceMotion.matches || timer) return
    timer = setInterval(() => {
      if (!document.hidden) go(current + 1)
    }, AUTOPLAY_MS)
  }
  function stop(): void {
    paused = true
    clearInterval(timer)
    timer = undefined
  }
  const showcase = track.closest('.showcase')
  showcase?.addEventListener('pointerdown', stop)
  showcase?.addEventListener('focusin', stop)
  showcase?.addEventListener('mouseenter', () => (clearInterval(timer), (timer = undefined)))
  showcase?.addEventListener('mouseleave', start)
  start()
}
