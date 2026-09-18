import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  cancelJob,
  deleteJob,
  download,
  ensureBackendAwake,
  formatBytes,
  inspectFiles,
  jobStatus,
  requestCleanup,
  startClean,
  type AppConfig,
  type CleanResult,
  type InspectResult,
  type UploadHandle,
} from '../api'
import FileList from './FileList'
import Landing from './Landing'
import ProgressBar from './ProgressBar'
import { trackEvent } from '../analytics'
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  DownloadIcon,
  SearchIcon,
  StopIcon,
  TrashIcon,
} from './Icons'

export interface LocalFile {
  id: number
  file: File
  name: string
  size: number
  status: 'idle' | 'busy' | 'clean' | 'warning' | 'failed' | 'stopped'
  summary?: string
  downloadUrl?: string
  report: Record<string, unknown> | null
  expanded: boolean
}

interface Props {
  onUseText: () => void
  config: AppConfig | null
}

type Phase = 'idle' | 'inspect' | 'clean'
type ServerJob = { id: string; token: string; statusUrl: string }

let nextId = 1

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

/** Effective fallback retention in minutes, derived from the backend value. */
function retentionMinutes(config: AppConfig | null, ttlSeconds: number): number {
  const seconds = config?.jobTtlSeconds ?? ttlSeconds
  return Math.max(1, Math.round(seconds / 60))
}

export default function FilesMode({ onUseText, config }: Props) {
  const [files, setFiles] = useState<LocalFile[]>([])
  const [preserveMetadata, setPreserveMetadata] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [deletionNotice, setDeletionNotice] = useState<'confirmed' | 'requested' | null>(null)
  const [zipUrl, setZipUrl] = useState<string | null>(null)
  const [batchSummary, setBatchSummary] = useState<string | null>(null)
  const activeJobRef = useRef<ServerJob | null>(null)
  const stopRef = useRef(false)
  const uploadRef = useRef<UploadHandle<unknown> | null>(null)
  const mountedRef = useRef(true)

  // The job id currently shown in the workspace, retained so delete/cleanup can
  // target it even after the workspace is dismissed.
  const shownJobRef = useRef<ServerJob | null>(null)
  const [shownJob, setShownJob] = useState<ServerJob | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      const job = shownJobRef.current
      if (job) requestCleanup(job.id, job.token)
      mountedRef.current = false
    }
  }, [])

  const busy = phase !== 'idle'

  const ttlSeconds = config?.jobTtlSeconds ?? 900
  const fallbackMinutes = retentionMinutes(config, ttlSeconds)

  function addFiles(incoming: File[]) {
    if (shownJobRef.current) {
      void purgeActiveJob(false)
      setFiles((items) => items.map((item) => ({ ...item, downloadUrl: undefined })))
      setZipUrl(null)
    }
    setFiles((current) => {
      const known = new Set(current.map((item) => `${item.name}:${item.size}`))
      const merged = [...current]
      for (const file of incoming) {
        if (file.size === 0) continue
        const key = `${file.name}:${file.size}`
        if (known.has(key)) continue
        known.add(key)
        merged.push({
          id: nextId++,
          file,
          name: file.name,
          size: file.size,
          status: 'idle',
          report: null,
          expanded: false,
        })
      }
      return merged
    })
    setError(null)
  }

  function removeFile(id: number) {
    setFiles((items) => items.filter((item) => item.id !== id))
  }

  function toggleReport(id: number) {
    setFiles((items) =>
      items.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item)),
    )
  }

  // Immediately purge the active job and delete its server files.
  const purgeActiveJob = useCallback(async (announce = true) => {
    const job = shownJobRef.current
    shownJobRef.current = null
    setShownJob(null)
    if (!job) return
    try {
      const confirmed = await deleteJob(job.id, job.token)
      if (announce) setDeletionNotice(confirmed ? 'confirmed' : 'requested')
    } catch {
      if (announce) setDeletionNotice('requested')
    }
  }, [])

  function clearFiles() {
    void purgeActiveJob()
    setFiles([])
    setZipUrl(null)
    setBatchSummary(null)
    setError(null)
    setExpired(false)
  }

  function stop() {
    stopRef.current = true
    const job = activeJobRef.current
    if (job) {
      // Cancel processing; files stay until an explicit delete or the fallback.
      cancelJob(job.id, job.token).catch(() => undefined)
    }
    uploadRef.current?.abort()
  }

  function markBusy() {
    setFiles((items) =>
      items.map((item) => ({
        ...item,
        status: 'busy',
        summary: undefined,
        downloadUrl: undefined,
        report: null,
        expanded: false,
      })),
    )
  }

  async function runInspect() {
    if (files.length === 0 || busy) return
    trackEvent('upload_start', { fileCount: files.length, mode: 'inspect' })
    setPhase('inspect')
    setError(null)
    setBatchSummary(null)
    setUploading(true)
    setUploadProgress(0)
    stopRef.current = false
    markBusy()
    await ensureBackendAwake()
    if (stopRef.current || !mountedRef.current) return
    const handle = inspectFiles(
      files.map((item) => item.file),
      preserveMetadata,
      (loaded, total) => setUploadProgress(total > 0 ? loaded / total : 1),
    )
    uploadRef.current = handle
    try {
      const results: InspectResult[] = await handle.promise
      setUploading(false)
      applyInspectResults(results)
      setBatchSummary(`${results.length} file${results.length === 1 ? '' : 's'} inspected.`)
    } catch (caught) {
      setUploading(false)
      if (stopRef.current) {
        finishStopped()
        return
      }
      failBusy(caught)
    } finally {
      setPhase('idle')
      uploadRef.current = null
      activeJobRef.current = null
    }
  }

  async function runClean() {
    if (files.length === 0 || busy) return
    await purgeActiveJob(false)
    trackEvent('upload_start', { fileCount: files.length, mode: 'clean' })
    setPhase('clean')
    setError(null)
    setBatchSummary(null)
    setZipUrl(null)
    setUploading(true)
    setUploadProgress(0)
    stopRef.current = false
    markBusy()
    await ensureBackendAwake()
    if (stopRef.current || !mountedRef.current) return
    const handle = startClean(
      files.map((item) => item.file),
      preserveMetadata,
      (loaded, total) => setUploadProgress(total > 0 ? loaded / total : 1),
    )
    uploadRef.current = handle
    try {
      const started = await handle.promise
      setUploading(false)
      const job = { id: started.jobId, token: started.jobToken, statusUrl: started.statusUrl }
      activeJobRef.current = job
      shownJobRef.current = job
      setShownJob(job)
      setZipUrl(started.zipUrl)
      await pollJob(job)
    } catch (caught) {
      setUploading(false)
      if (stopRef.current) {
        finishStopped()
        return
      }
      failBusy(caught)
    } finally {
      setPhase('idle')
      uploadRef.current = null
      activeJobRef.current = null
    }
  }

  async function pollJob(job: ServerJob) {
    while (mountedRef.current) {
      let status
      try {
        status = await jobStatus(job.statusUrl)
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) {
          // The job expired or was purged (e.g. after a ZIP download).
          handleExpired()
          return
        }
        failBusy(caught)
        return
      }
      applyCleanResults(status.results)
      if (status.error) {
        setError(status.error)
        failBusy(new ApiError(0, status.error))
        return
      }
      if (status.done) {
        if (status.cancelled) {
          finishStopped()
          setBatchSummary('Stopped after the current file.')
        } else {
          trackEvent('clean_complete', { fileCount: files.length })
          setBatchSummary('Batch finished.')
        }
        return
      }
      await sleep(500)
    }
  }

  function applyInspectResults(results: InspectResult[]) {
    setFiles((items) =>
      items.map((item, position) => {
        const result = results[position]
        if (!result) return item
        return {
          ...item,
          status: result.ok ? 'clean' : 'failed',
          summary: result.summary,
          report: result.report,
        }
      }),
    )
  }

  function applyCleanResults(results: CleanResult[]) {
    if (results.length === 0) return
    setFiles((items) =>
      items.map((item, position) => {
        const result = results[position]
        if (!result) return item
        return {
          ...item,
          status: result.ok ? (result.warning ? 'warning' : 'clean') : 'failed',
          summary: result.summary,
          downloadUrl: result.downloadUrl,
          report: result.report,
        }
      }),
    )
  }

  function finishStopped() {
    setFiles((items) =>
      items.map((item) => (item.status === 'busy' ? { ...item, status: 'stopped' } : item)),
    )
  }

  function failBusy(caught: unknown) {
    setError(caught instanceof ApiError ? caught.message : 'The operation failed.')
    setFiles((items) =>
      items.map((item) => (item.status === 'busy' ? { ...item, status: 'failed' } : item)),
    )
  }

  function handleExpired() {
    setExpired(true)
    setError(null)
    setBatchSummary(null)
    setZipUrl(null)
    setFiles([])
    shownJobRef.current = null
    setShownJob(null)
  }

  const totalBytes = files.reduce((sum, item) => sum + item.size, 0)

  // Best-effort cleanup when the page is closed or hidden. This is not
  // guaranteed: the browser or network may drop the request. The 15-minute
  // server-side fallback covers the cases this misses.
  useEffect(() => {
    const job = shownJobRef.current
    if (!job) return

    const fireCleanup = () => {
      if (shownJobRef.current === job) requestCleanup(job.id, job.token)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') fireCleanup()
    }
    window.addEventListener('pagehide', fireCleanup)
    window.addEventListener('beforeunload', fireCleanup)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', fireCleanup)
      window.removeEventListener('beforeunload', fireCleanup)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [shownJob])

  async function downloadZip() {
    if (zipUrl) {
      try {
        await download(zipUrl)
        trackEvent('download', { type: 'zip' })
        setDeletionNotice('requested')
        setZipUrl(null)
        setFiles((items) => items.map((item) => ({ ...item, downloadUrl: undefined })))
        shownJobRef.current = null
        setShownJob(null)
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404) handleExpired()
        else failBusy(caught)
      }
    }
  }

  return (
    <div className="files-mode">
      <Landing
        onFiles={addFiles}
        onUseText={onUseText}
        busy={busy}
        fallbackMinutes={fallbackMinutes}
        notice={
          <>
            {deletionNotice && (
              <div
                className={`banner ${deletionNotice === 'confirmed' ? 'ok' : 'warn'} deletion-banner`}
                role="status"
              >
                {deletionNotice === 'confirmed' ? <CheckIcon size={16} /> : <ClockIcon size={16} />}
                {deletionNotice === 'confirmed'
                  ? 'Temporary server files were deleted.'
                  : 'Cleanup was requested. If it could not be confirmed, the fallback expiry still applies.'}
              </div>
            )}
            {expired && (
              <div className="banner warn deletion-banner" role="alert">
                <AlertIcon size={16} />
                These files have expired or were already deleted on the server. Upload them again
                to start a new job.
              </div>
            )}
          </>
        }
        workspace={files.length > 0 ? (
          <div className="workspace">
          <header className="workspace-head">
            <div>
              <h2 className="workspace-title">Your files</h2>
              <p className="workspace-sub">
                {files.length} file{files.length === 1 ? '' : 's'} · {formatBytes(totalBytes)} ·
                cleaned copies stay separate from originals
              </p>
            </div>
            <div className="workspace-head-actions">
              {zipUrl && (
                <button className="btn small" onClick={downloadZip}>
                  <DownloadIcon size={14} />
                  Download all (.zip)
                </button>
              )}
              {!busy && (
                <button className="btn ghost small" onClick={clearFiles}>
                  <TrashIcon size={14} />
                  Clear &amp; delete files
                </button>
              )}
            </div>
          </header>

          <div className="toolbar">
            <label className="toggle">
              <input
                type="checkbox"
                checked={preserveMetadata}
                disabled={busy}
                onChange={(event) => setPreserveMetadata(event.target.checked)}
              />
              <span className="toggle-labels">
                <span className="toggle-label">Keep non-AI metadata</span>
                <span className="toggle-note">Camera settings, dates, and ordinary fields stay</span>
              </span>
            </label>
            <div className="actions">
              <button className="btn ghost" onClick={runInspect} disabled={busy}>
                <SearchIcon size={15} />
                Inspect all
              </button>
              <button className="btn primary" onClick={runClean} disabled={busy}>
                <CheckIcon size={15} />
                Clean &amp; save copies
              </button>
              {busy && (
                <button className="btn danger" onClick={stop}>
                  <StopIcon size={14} />
                  Stop
                </button>
              )}
            </div>
          </div>

          <p className="retention-note">
            <ClockIcon size={13} />
            Temporary files are deleted after download, when you start over, or when you choose
            Delete files. They expire automatically within {fallbackMinutes} minute
            {fallbackMinutes === 1 ? '' : 's'}.
          </p>

          {busy && (
            <ProgressBar
              determinate={uploading}
              fraction={uploadProgress}
              label={uploading ? 'Uploading…' : 'Working — files are cleaned one by one.'}
            />
          )}

          <div className="status-region" aria-live="polite">
            {error && (
              <div className="banner err" role="alert">
                <AlertIcon size={16} />
                {error}
              </div>
            )}
            {batchSummary && (
              <div className="banner ok">
                <CheckIcon size={16} />
                {batchSummary}
              </div>
            )}
          </div>

          <FileList
            files={files}
            busy={busy}
            onAdd={addFiles}
            onRemove={removeFile}
            onToggle={toggleReport}
            onDownload={async (item) => {
              if (item.downloadUrl) {
                try {
                  await download(item.downloadUrl)
                  trackEvent('download', { type: 'single' })
                  setFiles((items) => {
                    const updated = items.map((current) =>
                      current.id === item.id ? { ...current, downloadUrl: undefined } : current,
                    )
                    if (!updated.some((current) => current.downloadUrl)) {
                      setZipUrl(null)
                      shownJobRef.current = null
                      setShownJob(null)
                    }
                    return updated
                  })
                  setDeletionNotice('requested')
                } catch (caught) {
                  if (caught instanceof ApiError && caught.status === 404) handleExpired()
                  else failBusy(caught)
                }
              }
            }}
          />
          </div>
        ) : undefined}
      />
    </div>
  )
}
