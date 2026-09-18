import { useEffect, useState } from 'react'
import FilesMode from './components/FilesMode'
import TextMode from './components/TextMode'
import { ClockIcon } from './components/Icons'
import { trackEvent } from './analytics'

type Mode = 'files' | 'text'

export default function App() {
  const [mode, setMode] = useState<Mode>('files')

  useEffect(() => {
    trackEvent('page_view', { path: mode })
  }, [mode])

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="brand">
          <img className="logo" src="/logo.svg" alt="Watermarks Cleaner logo" width={36} height={36} />
          <div className="brand-text">
            <span className="brand-name">Watermarks Cleaner</span>
            <span className="brand-note">Private by design · No account required</span>
          </div>
        </div>
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
        {mode === 'files' ? <FilesMode /> : <TextMode />}
      </main>
      <footer className="site-footer">
        <p>
          Built by{' '}
          <a href="https://github.com/touhidulemroz" target="_blank" rel="noreferrer">
            touhidulemroz
          </a>{' '}
          on the{' '}
          <a
            href="https://github.com/guillaumemeyer/watermarks-remover"
            target="_blank"
            rel="noreferrer"
          >
            watermarks-remover
          </a>{' '}
          engine (MIT) ·{' '}
          <a
            href="https://github.com/touhidulemroz/watermarks-cleaner-mac"
            target="_blank"
            rel="noreferrer"
          >
            source
          </a>
        </p>
        <p className="footer-note">
          <ClockIcon size={13} />
          Uploaded and cleaned files are automatically deleted after one hour.
        </p>
      </footer>
    </div>
  )
}
