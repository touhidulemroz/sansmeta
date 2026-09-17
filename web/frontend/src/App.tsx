import { useEffect, useState } from 'react'
import FilesMode from './components/FilesMode'
import TextMode from './components/TextMode'
import { trackEvent } from './analytics'

type Mode = 'files' | 'text'

export default function App() {
  const [mode, setMode] = useState<Mode>('files')

  useEffect(() => {
    trackEvent('page_view', { path: mode })
  }, [mode])

  return (
    <div className="shell">
      <header className="header">
        <img className="logo" src="/logo.svg" alt="" width={40} height={40} />
        <div className="title">
          <h1>Watermarks Cleaner</h1>
          <p>Remove AI provenance metadata &amp; hidden watermark characters</p>
        </div>
        <nav className="tabs" aria-label="Mode">
          <button
            className={mode === 'files' ? 'active' : ''}
            onClick={() => setMode('files')}
            onMouseUp={() => trackEvent('mode_switch', { mode: 'files' })}
          >
            Files
          </button>
          <button
            className={mode === 'text' ? 'active' : ''}
            onClick={() => setMode('text')}
            onMouseUp={() => trackEvent('mode_switch', { mode: 'text' })}
          >
            Text
          </button>
        </nav>
      </header>
      <main>{mode === 'files' ? <FilesMode /> : <TextMode />}</main>
      <footer className="footer">
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
        </a>{' '}
        · cleaned files are deleted after 1 h
      </footer>
    </div>
  )
}
