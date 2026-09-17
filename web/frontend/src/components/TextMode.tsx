import { useState } from 'react'
import { ApiError, cleanText } from '../api'

export default function TextMode() {
  const [source, setSource] = useState('')
  const [output, setOutput] = useState('')
  const [stats, setStats] = useState<{ removed: number; replaced: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function runClean() {
    if (busy) return
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
      <div className="pane">
        <div className="pane-head">
          <span>Original text</span>
          <span className="count">{source.length.toLocaleString()} characters</span>
        </div>
        <textarea
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Paste text that may contain hidden watermark characters…"
          spellCheck={false}
        />
      </div>
      <div className="text-actions">
        <button className="btn" onClick={runClean} disabled={busy || source.length === 0}>
          {busy ? 'Cleaning…' : 'Clean text'}
        </button>
        <button className="btn ghost" onClick={copyOutput} disabled={!output}>
          {copied ? 'Copied' : 'Copy result'}
        </button>
        <button
          className="btn ghost"
          onClick={clearAll}
          disabled={!source && !output}
        >
          Clear
        </button>
      </div>
      <div className="pane">
        <div className="pane-head">
          <span>Cleaned text</span>
          {stats && (
            <span className="stats">
              <span className="chip clean">{stats.removed} removed</span>
              <span className="chip clean">{stats.replaced} replaced</span>
            </span>
          )}
        </div>
        <textarea value={output} readOnly placeholder="Result appears here…" spellCheck={false} />
      </div>
      {error && <div className="banner err">{error}</div>}
    </div>
  )
}
