import { useState } from 'react'
import { ApiError, cleanText, ensureBackendAwake, type AppConfig } from '../api'
import { trackEvent } from '../analytics'
import {
  AlertIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  LockIcon,
  MinusCircleIcon,
  ResetIcon,
  ShieldIcon,
} from './Icons'

interface Props {
  config?: AppConfig | null
  onUseFiles?: () => void
}

export default function TextMode({ config, onUseFiles }: Props = {}) {
  const fallbackMinutes = Math.max(1, Math.round((config?.jobTtlSeconds ?? 900) / 60))
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
      await ensureBackendAwake()
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

        <div className="text-column-connector" aria-hidden="true">
          <div className="connector-line" />
          <span className="connector-circle">
            <ArrowRightIcon size={15} />
          </span>
          <div className="connector-line" />
        </div>

        <div className="pane">
          <div className="pane-head">
            <label htmlFor="text-result">Cleaned text</label>
            <span className="count">{output.length.toLocaleString()} characters</span>
          </div>

          {stats && (
            <div
              className={`pane-status-bar ${stats.removed > 0 || stats.replaced > 0 ? 'success' : 'neutral'}`}
              role="status"
              aria-live="polite"
            >
              {stats.removed > 0 || stats.replaced > 0 ? (
                <span className="status-badge success">
                  <CheckCircleIcon size={14} />
                  <span>
                    {(() => {
                      const total = stats.removed + stats.replaced
                      if (stats.removed > 0 && stats.replaced > 0) {
                        return `${stats.removed} removed, ${stats.replaced} replaced`
                      }
                      return `${total} invisible ${total === 1 ? "character" : "characters"} removed`
                    })()}
                  </span>
                </span>
              ) : (
                <span className="status-badge neutral">
                  <MinusCircleIcon size={14} />
                  <span>No hidden characters found</span>
                </span>
              )}
            </div>
          )}

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

      {onUseFiles && (
        <button type="button" className="text-mode-link" onClick={onUseFiles}>
          Prefer files? Clean AI watermarks &amp; metadata from files instead
        </button>
      )}

      {/* Consistent Trust Signals across modes */}
      <div className="hero-trust-bar text-trust-bar">
        <span className="trust-pill">
          <LockIcon size={13} /> No account
        </span>
        <span className="trust-pill">
          <ShieldIcon size={13} /> Originals untouched
        </span>
        <span className="trust-pill">
          <ClockIcon size={13} /> Auto-purged in {fallbackMinutes}m
        </span>
        <span className="trust-sep">&middot;</span>
        <span className="trust-meta">Zero storage &middot; Ephemeral processing</span>
      </div>

      {/* Mini-explainer: What gets cleaned from your text */}
      <section className="text-explainer" aria-labelledby="text-explainer-heading">
        <h2 id="text-explainer-heading" className="text-explainer-title">
          What gets cleaned from your text
        </h2>
        <div className="text-explainer-grid">
          <div className="text-explainer-card">
            <div className="explainer-card-icon" aria-hidden="true">
              <CheckCircleIcon size={18} />
            </div>
            <h3>Zero-Width Spaces &amp; Joiners</h3>
            <p>
              Strips U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), and U+FEFF (BOM) frequently injected as invisible steganographic tracking fingerprints.
            </p>
          </div>
          <div className="text-explainer-card">
            <div className="explainer-card-icon" aria-hidden="true">
              <CheckCircleIcon size={18} />
            </div>
            <h3>BiDi &amp; Directional Overrides</h3>
            <p>
              Removes Right-to-Left / Left-to-Right embedding and isolate marks (Trojan Source) that disguise text structure or spoof executable strings.
            </p>
          </div>
          <div className="text-explainer-card">
            <div className="explainer-card-icon" aria-hidden="true">
              <CheckCircleIcon size={18} />
            </div>
            <h3>Invisible Controls &amp; Tags</h3>
            <p>
              Purges soft hyphens (U+00AD), Unicode tag characters (U+E0000+), word joiners, and hidden variation selectors while preserving visible words.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
