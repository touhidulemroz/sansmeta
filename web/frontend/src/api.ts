export interface InspectResult {
  name: string
  ok: boolean
  summary: string
  report: Record<string, unknown> | null
}

export interface CleanResult {
  index: number
  name: string
  ok: boolean
  summary: string
  warning?: boolean
  downloadUrl?: string
  report: Record<string, unknown> | null
}

export interface CleanStartResponse {
  jobId: string
  statusUrl: string
  zipUrl: string
}

export interface JobStatus {
  done: boolean
  cancelled: boolean
  error: string | null
  results: CleanResult[]
  zipUrl: string
}

export interface TextResult {
  ok: boolean
  text?: string
  report?: Record<string, unknown>
  summary: string
}

export const MAX_BATCH_FILES = 50
export const MAX_FILE_MB = 256

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export interface UploadHandle<T> {
  promise: Promise<T>
  abort: () => void
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = (await response.json()) as { detail?: string }
      if (body.detail) message = body.detail
    } catch {
      // keep the default message
    }
    throw new ApiError(response.status, message)
  }
  return (await response.json()) as T
}

function upload<T>(
  url: string,
  files: File[],
  preserveMetadata: boolean,
  onProgress?: (loaded: number, total: number) => void,
): UploadHandle<T> {
  const xhr = new XMLHttpRequest()
  xhr.open('POST', url)
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && onProgress) onProgress(event.loaded, event.total)
  }
  const promise = new Promise<T>((resolve, reject) => {
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        // body stays null
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T)
      } else {
        const detail = (body as { detail?: string } | null)?.detail
        reject(new ApiError(xhr.status, detail ?? `Upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new ApiError(0, 'Network error — is the backend running?'))
    xhr.onabort = () => reject(new ApiError(0, 'Aborted'))
  })
  const form = new FormData()
  for (const file of files) form.append('files', file, file.name)
  form.append('preserveMetadata', String(preserveMetadata))
  xhr.send(form)
  return { promise, abort: () => xhr.abort() }
}

interface InspectResponse {
  results: InspectResult[]
  cancelled: boolean
}

export function inspectFiles(
  files: File[],
  preserveMetadata: boolean,
  onProgress?: (loaded: number, total: number) => void,
): UploadHandle<InspectResult[]> {
  const handle = upload<InspectResponse>('/api/inspect', files, preserveMetadata, onProgress)
  return {
    promise: handle.promise.then((response) => response.results),
    abort: handle.abort,
  }
}

export function startClean(
  files: File[],
  preserveMetadata: boolean,
  onProgress?: (loaded: number, total: number) => void,
): UploadHandle<CleanStartResponse> {
  return upload<CleanStartResponse>('/api/clean', files, preserveMetadata, onProgress)
}

export async function jobStatus(jobId: string): Promise<JobStatus> {
  return json(await fetch(`/api/jobs/${jobId}/status`))
}

export async function cancelJob(jobId: string): Promise<void> {
  const response = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
  if (!response.ok) throw new ApiError(response.status, 'Could not cancel the job.')
}

export async function cleanText(text: string): Promise<TextResult> {
  return json(
    await fetch('/api/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  )
}

export function download(url: string): void {
  const anchor = document.createElement('a')
  anchor.href = url
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
