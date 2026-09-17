declare global {
  interface Window {
    dataLayer?: unknown[]
  }
}

export function trackEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.dataLayer) {
    window.dataLayer.push({
      event: name,
      ...props,
    })
  }
}
