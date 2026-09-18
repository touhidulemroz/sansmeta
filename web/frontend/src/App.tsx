import { useEffect, useRef, useState } from 'react'
import FilesMode from './components/FilesMode'
import TextMode from './components/TextMode'
import ConsentBanner from './components/ConsentBanner'
import { TrashIcon } from './components/Icons'
import { ensureBackendAwake, fetchConfig, type AppConfig, type BackendStatusEvent } from './api'
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
  const [wakeEvent, setWakeEvent] = useState<BackendStatusEvent | null>(null)
  const [showReady, setShowReady] = useState(false)
  const wasWakingRef = useRef(false)

  useEffect(() => {
    initAnalytics()
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg)
      })
      .catch(() => {
        // Backend might be spinning up after inactivity on Render free tier
        void ensureBackendAwake((ev) => {
          setWakeEvent(ev)
          if (ev.state === 'waking') {
            wasWakingRef.current = true
          } else if (ev.state === 'ready') {
            void fetchConfig().then(setConfig).catch(() => undefined)
            if (wasWakingRef.current) {
              setShowReady(true)
              setTimeout(() => setShowReady(false), 4500)
            }
          }
        })
      })
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
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            setMode("files");
            window.history.pushState(null, "", "/");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
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
        </a>
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
        {wakeEvent?.state === 'waking' && (
          <div className="engine-status-bar waking" role="status" aria-live="polite">
            <span className="engine-status-dot" aria-hidden="true" />
            <span>
              <strong>Starting secure engine:</strong> Server is waking up from inactivity
              {wakeEvent.elapsedSeconds > 0 ? ` (${wakeEvent.elapsedSeconds}s)` : ''}.
              You can select your files now.
            </span>
          </div>
        )}
        {showReady && (
          <div className="engine-status-bar ready" role="status">
            <span className="engine-status-dot" aria-hidden="true" />
            <span>Processing engine ready. Secure workspaces active.</span>
          </div>
        )}
        {wakeEvent?.state === 'offline' && (
          <div className="engine-status-bar offline" role="alert">
            <span className="engine-status-dot" aria-hidden="true" />
            <span>Processing engine took longer than expected to start. Please refresh or try again.</span>
          </div>
        )}
        {mode === 'files' ? (
          <FilesMode onUseText={() => setMode('text')} config={config} />
        ) : (
          <TextMode config={config} onUseFiles={() => setMode('files')} />
        )}
      </main>
      <footer className="site-footer">
        <div className="footer-card">
          <div className="footer-grid">
            <div className="footer-brand-col">
              <div className="footer-brand">
                <img
                  src="/logo-mark.png"
                  alt="SansMeta logo"
                  width={22}
                  height={31}
                  className="footer-logo"
                />
                <span className="brand-name">SansMeta</span>
              </div>
              <p className="footer-description">
                Inspect and clean hidden AI metadata, provenance fields (C2PA, EXIF, XMP), and invisible characters from your files online for free.
              </p>
              <div className="footer-badge">
                <span className="badge-dot" aria-hidden="true" />
                <span>Zero tracking &middot; Ephemeral storage</span>
              </div>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Navigation</h4>
              <ul className="footer-nav-list">
                <li><a href="#how-it-works">How it works</a></li>
                <li><a href="#formats">Supported formats</a></li>
                <li><a href="#privacy">Privacy overview</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4 className="footer-heading">Open Source</h4>
              <ul className="footer-nav-list">
                <li>
                  <a href="https://github.com/touhidulemroz/watermarks-cleaner-mac" target="_blank" rel="noreferrer">
                    SansMeta on GitHub
                  </a>
                </li>
                <li>
                  <a href="https://github.com/guillaumemeyer/watermarks-remover" target="_blank" rel="noreferrer">
                    watermarks-remover (MIT)
                  </a>
                </li>
                <li>
                  <a href="/privacy/">Privacy Policy</a>
                </li>
              </ul>
            </div>

            <div className="footer-col footer-col-lifecycle">
              <h4 className="footer-heading">File Lifecycle</h4>
              <p className="footer-lifecycle-note">
                <TrashIcon size={14} />
                <span>
                  Auto-deleted after download or after {fallbackMinutes} minute
                  {fallbackMinutes === 1 ? '' : 's'} of inactivity.
                </span>
              </p>
              <p className="footer-lifecycle-sub">
                Originals are never modified. Closing the tab triggers immediate cleanup.
              </p>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-bottom-copy">
              &copy; {new Date().getFullYear()} SansMeta &middot; Online AI Metadata Cleaner
            </p>
            <p className="footer-bottom-author">
              Crafted by <a href="https://github.com/touhidulemroz" target="_blank" rel="noreferrer">@touhidulemroz</a>
            </p>
          </div>
        </div>
      </footer>
      <ConsentBanner />
    </div>
  )
}
