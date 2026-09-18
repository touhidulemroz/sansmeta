import { useEffect, useState } from 'react'
import { readConsent, setConsent } from '../analytics'

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(readConsent() === null)
  }, [])

  if (!visible) return null

  return (
    <aside className="consent-banner" aria-label="Analytics consent" role="region">
      <p>
        SansMeta uses Google Analytics to understand usage, with your consent. Only aggregate
        events are sent — never filenames, file contents, or pasted text.{' '}
        <a href="/privacy/" target="_blank" rel="noreferrer">
          How analytics works
        </a>
      </p>
      <div className="consent-actions">
        <button
          className="btn small primary"
          onClick={() => {
            setConsent('granted')
            setVisible(false)
          }}
        >
          Accept
        </button>
        <button
          className="btn small ghost"
          onClick={() => {
            setConsent('denied')
            setVisible(false)
          }}
        >
          Decline
        </button>
      </div>
    </aside>
  )
}
