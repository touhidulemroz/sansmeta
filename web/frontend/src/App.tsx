import { useEffect, useState } from 'react'
import FilesMode from './components/FilesMode'
import TextMode from './components/TextMode'
import ConsentBanner from './components/ConsentBanner'
import { TrashIcon } from './components/Icons'
import { fetchConfig, type AppConfig } from './api'
import { initAnalytics, trackEvent } from './analytics'

type Mode = 'files' | 'text'

const NAV = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#formats', label: 'Formats' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
]

export default function App() {
  const [mode, setMode] = useState<Mode>('files')
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    initAnalytics()
    fetchConfig().then(setConfig).catch(() => setConfig(null))
  }, [])

  useEffect(() => {
    trackEvent('page_view', { path: mode })
  }, [mode])

  const fallbackMinutes = Math.max(1, Math.round((config?.jobTtlSeconds ?? 900) / 60))

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="brand">
          <img
            className="logo"
            src="/logo-mark.png"
            alt="SansMeta logo"
            width={34}
            height={48}
          />
          <div className="brand-text">
            <span className="brand-name">SansMeta</span>
            <span className="brand-note">Remove hidden AI metadata, online</span>
          </div>
        </div>
        <nav className="site-nav" aria-label="Main">
          <ul>
            {NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href} onClick={() => trackEvent('nav_click', { target: item.href })}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mode-switch" role="group" aria-label="Mode">
          <button
            className={mode === 'files' ? 'active' : ''}
            aria-pressed={mode === 'files'}
            onClick={() => setMode('files')}
            onMouseUp={() => trackEvent('mode_switch', { mode: 'files' })}
          >
            Files
          </button>
          <button
            className={mode === 'text' ? 'active' : ''}
            aria-pressed={mode === 'text'}
            onClick={() => setMode('text')}
            onMouseUp={() => trackEvent('mode_switch', { mode: 'text' })}
          >
            Text
          </button>
        </div>
      </header>
      <main className="main-content" id="main-content">
        {mode === 'files' ? (
          <FilesMode onUseText={() => setMode('text')} config={config} />
        ) : (
          <TextMode />
        )}
      </main>
      <footer className="site-footer">
        <p className="footer-links">
          <a href="/privacy/">Privacy</a>
          <span aria-hidden="true">·</span>
          <a href="#faq">FAQ</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/touhidulemroz/watermarks-cleaner-mac" target="_blank" rel="noreferrer">
            Source on GitHub
          </a>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/guillaumemeyer/watermarks-remover"
            target="_blank"
            rel="noreferrer"
          >
            watermarks-remover engine (MIT)
          </a>
        </p>
        <p className="footer-note">
          <TrashIcon size={13} />
          Temporary files are deleted after download, when you start over, or when you choose
          Delete files &mdash; and expire automatically within {fallbackMinutes} minute
          {fallbackMinutes === 1 ? '' : 's'}.
        </p>
        <p className="footer-note footer-note-soft">
          Closing the page sends a best-effort deletion request, but a browser or network
          interruption may prevent confirmation.
        </p>
        <p className="footer-tagline">Remove hidden AI metadata online for free.</p>
      </footer>
      <ConsentBanner />
    </div>
  )
}
