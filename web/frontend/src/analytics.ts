const GA_MEASUREMENT_ID = 'G-YEC7FP0XWY'
const CONSENT_KEY = 'sansmeta-analytics-consent'

export type AnalyticsConsent = 'granted' | 'denied' | null

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function readConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY)
    return stored === 'granted' || stored === 'denied' ? stored : null
  } catch {
    return null
  }
}

export function setConsent(choice: 'granted' | 'denied') {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CONSENT_KEY, choice)
  } catch {
    // Storage may be unavailable; tracking just stays off.
  }
  if (choice === 'granted') loadGa()
}

let loaded = false

function loadGa() {
  if (typeof window === 'undefined' || loaded) return
  loaded = true
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
  if (typeof window.gtag === 'function') {
    window.gtag('js', new Date())
    window.gtag('config', GA_MEASUREMENT_ID)
  }
}

export function initAnalytics() {
  if (readConsent() === 'granted') loadGa()
}

/**
 * Aggregate events only: never filenames, file contents, pasted text,
 * or download tokens. Pushing is gated on explicit consent; before the
 * gtag script loads, pushes are buffered by the dataLayer stub.
 */
export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  if (readConsent() !== 'granted') return
  if (!window.dataLayer) window.dataLayer = []
  window.dataLayer.push({
    event: name,
    ...props,
  })
}
