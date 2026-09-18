import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  cancelJob,
  download,
  formatBytes,
  inspectFiles,
  jobStatus,
  startClean,
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
  DownloadIcon,
  SearchIcon,
  SparkleIcon,
  StopIcon,
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

type Phase = 'idle' | 'inspect' | 'clean'

let nextId = 1

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export default function FilesMode() {
  const [files, setFiles] = useState<LocalFile[]>([])
  const [preserveMetadata, setPreserveMetadata] = useState(true)
  const [phase, setPhase] = useState<Phase>('idle')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [zipUrl, setZipUrl] = useState<string | null>(null)
  const [batchSummary, setBatchSummary] = useState<string | null>(null)
  const jobRef = useRef<string | null>(null)
  const stopRef = useRef(false)
  const uploadRef = useRef<UploadHandle<unknown> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const busy = phase !== 'idle'

  function addFiles(incoming: File[]) {
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

  function clearFiles() {
    setFiles([])
    setZipUrl(null)
    setBatchSummary(null)
    setError(null)
  }

  function toggleReport(id: number) {
    setFiles((items) =>
      items.map((item) => (item.id === id ? { ...item, expanded: !item.expanded } : item)),
    )
  }

  function stop() {
    stopRef.current = true
    if (jobRef.current) {
      cancelJob(jobRef.current).catch(() => undefined)
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
      jobRef.current = null
    }
  }

  async function runClean() {
    if (files.length === 0 || busy) return
    trackEvent('upload_start', { fileCount: files.length, mode: 'clean' })
    setPhase('clean')
    setError(null)
    setBatchSummary(null)
    setZipUrl(null)
    setUploading(true)
    setUploadProgress(0)
    stopRef.current = false
    markBusy()
    const handle = startClean(
      files.map((item) => item.file),
      preserveMetadata,
      (loaded, total) => setUploadProgress(total > 0 ? loaded / total : 1),
    )
    uploadRef.current = handle
    try {
      const started = await handle.promise
      setUploading(false)
      jobRef.current = started.jobId
      setZipUrl(started.zipUrl)
      await pollJob(started.jobId)
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
      jobRef.current = null
    }
  }

  async function pollJob(jobId: string) {
    while (mountedRef.current) {
      let status
      try {
        status = await jobStatus(jobId)
      } catch (caught) {
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

  if (files.length === 0) {
    return <Landing onFiles={addFiles} busy={busy} />
  }

  const totalBytes = files.reduce((sum, item) => sum + item.size, 0)

  function downloadZip() {
    if (zipUrl) {
      download(zipUrl)
      trackEvent('download', { type: 'zip' })
    }
  }

  return (
    <div className="workspace">
      <header className="workspace-head">
        <div>
          <h1 className="workspace-title">Your files</h1>
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
              Clear list
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
            <SparkleIcon size={15} />
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
        onDownload={(item) => {
          if (item.downloadUrl) {
            download(item.downloadUrl)
            trackEvent('download', { type: 'single' })
          }
        }}
      />
    </div>
  )
}
