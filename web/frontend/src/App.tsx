import { useState } from 'react'
import FilesMode from './components/FilesMode'
import TextMode from './components/TextMode'

type Mode = 'files' | 'text'

export default function App() {
  const [mode, setMode] = useState<Mode>('files')

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
          >
            Files
          </button>
          <button
            className={mode === 'text' ? 'active' : ''}
            onClick={() => setMode('text')}
          >
            Text
          </button>
        </nav>
      </header>
      <main>{mode === 'files' ? <FilesMode /> : <TextMode />}</main>
      <footer className="footer">
        No account, no tracking — cleaned files are kept for 1 hour, then deleted automatically.
      </footer>
    </div>
  )
}
