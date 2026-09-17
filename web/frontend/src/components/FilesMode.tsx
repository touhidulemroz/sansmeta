import { useEffect, useRef, useState } from 'react'
import {
  ApiError,
  cancelJob,
  download,
  inspectFiles,
  jobStatus,
  startClean,
  type CleanResult,
  type InspectResult,
  type UploadHandle,
} from '../api'
import FileDropZone from './FileDropZone'
import FileList from './FileList'
import ProgressBar from './ProgressBar'

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

  return (
    <div className="files-mode">
      <div className="toolbar">
        <label className="toggle">
          <input
            type="checkbox"
            checked={preserveMetadata}
            disabled={busy}
            onChange={(event) => setPreserveMetadata(event.target.checked)}
          />
          <span>Keep non-AI metadata</span>
        </label>
        <div className="actions">
          <button
            className="btn ghost"
            onClick={runInspect}
            disabled={busy || files.length === 0}
          >
            Inspect all
          </button>
          <button
            className="btn"
            onClick={runClean}
            disabled={busy || files.length === 0}
          >
            Clean &amp; save copies…
          </button>
          {busy && (
            <button className="btn danger" onClick={stop}>
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
      {error && <div className="banner err">{error}</div>}
      {batchSummary && <div className="banner ok">{batchSummary}</div>}
      {files.length === 0 ? (
        <FileDropZone onFiles={addFiles} busy={busy} />
      ) : (
        <FileList
          files={files}
          busy={busy}
          zipUrl={zipUrl}
          onAdd={addFiles}
          onRemove={removeFile}
          onClear={clearFiles}
          onToggle={toggleReport}
          onDownload={(item) => item.downloadUrl && download(item.downloadUrl)}
          onDownloadZip={() => zipUrl && download(zipUrl)}
        />
      )}
    </div>
  )
}
