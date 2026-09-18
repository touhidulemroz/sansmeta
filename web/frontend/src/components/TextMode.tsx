import { useState } from 'react'
import { ApiError, cleanText } from '../api'
import { trackEvent } from '../analytics'
import { AlertIcon, CheckIcon, CopyIcon, ResetIcon } from './Icons'

export default function TextMode() {
  const [source, setSource] = useState('')
  const [output, setOutput] = useState('')
  const [stats, setStats] = useState<{ removed: number; replaced: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function runClean() {
    if (busy) return
    trackEvent('text_clean', { charCount: source.length })
    setBusy(true)
    setError(null)
    setCopied(false)
    try {
      const result = await cleanText(source)
      if (result.ok) {
        setOutput(result.text ?? '')
        const report = (result.report ?? {}) as Record<string, unknown>
        setStats({
          removed: Number(report.removed_count ?? 0),
          replaced: Number(report.replaced_count ?? 0),
        })
      } else {
        setError(result.summary)
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Cleaning failed.')
    } finally {
      setBusy(false)
    }
  }

  async function copyOutput() {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError('Could not copy — select the text and copy manually.')
    }
  }

  function clearAll() {
    setSource('')
    setOutput('')
    setStats(null)
    setError(null)
    setCopied(false)
  }

  return (
    <div className="text-mode">
      <header className="text-head">
        <h1>Clean invisible characters from text</h1>
        <p>
          Paste text to strip supported invisible Unicode characters — such as zero-width
          spaces — and see exactly how many were removed or replaced. Your text is sent to
          the server for processing.
        </p>
      </header>

      <div className="text-columns">
        <div className="pane">
          <div className="pane-head">
            <label htmlFor="text-source">Original text</label>
            <span className="count">{source.length.toLocaleString()} characters</span>
          </div>
          <textarea
            id="text-source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Paste text that may contain invisible characters…"
            spellCheck={false}
          />
          <div className="pane-actions">
            <button
              className="btn primary"
              onClick={runClean}
              disabled={busy || source.length === 0}
            >
              <CheckIcon size={15} />
              {busy ? 'Cleaning…' : 'Clean text'}
            </button>
          </div>
        </div>

        <div className="pane">
          <div className="pane-head">
            <label htmlFor="text-result">Cleaned text</label>
            <span className="stats" aria-live="polite">
              {stats && (
                <>
                  <span className="chip clean">{stats.removed} removed</span>
                  <span className="chip clean">{stats.replaced} replaced</span>
                </>
              )}
            </span>
          </div>
          <textarea
            id="text-result"
            value={output}
            readOnly
            placeholder="The cleaned text appears here…"
            spellCheck={false}
          />
          <div className="pane-actions">
            <button className="btn ghost" onClick={copyOutput} disabled={!output}>
              <CopyIcon size={15} />
              {copied ? 'Copied' : 'Copy result'}
            </button>
            <button className="btn ghost" onClick={clearAll} disabled={!source && !output}>
              <ResetIcon size={15} />
              Reset
            </button>
          </div>
        </div>
      </div>

      <span className="visually-hidden" aria-live="polite">
        {copied ? 'Result copied to clipboard' : ''}
      </span>

      {error && (
        <div className="banner err" role="alert">
          <AlertIcon size={16} />
          {error}
        </div>
      )}
      {copied && !error && (
        <div className="banner ok">
          <CheckIcon size={16} />
          Result copied to clipboard.
        </div>
      )}
    </div>
  )
}
