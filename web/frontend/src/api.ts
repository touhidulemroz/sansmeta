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
  jobToken: string
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

export interface AppConfig {
  jobTtlSeconds: number
  maxBatchFiles: number
  maxFileBytes: number
  maxTextBytes: number
}

export type BackendWakeState = 'idle' | 'checking' | 'waking' | 'ready' | 'offline'

export interface BackendStatusEvent {
  state: BackendWakeState
  elapsedSeconds: number
  message?: string
}

export const MAX_BATCH_FILES = 50
export const MAX_FILE_MB = 256

export const API_BASE_URL: string = (
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || ''
).replace(/\/+$/, '')

/**
 * Resolves an API path against the configured base URL if specified.
 * If path is already an absolute HTTP(S) URL, it is returned untouched.
 */
export function resolveApiUrl(path: string): string {
  if (!path) return path
  if (/^https?:\/\//i.test(path)) return path
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${cleanPath}`
}

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

let cachedReady = false

/**
 * Ping backend health with a timeout.
 */
export async function checkBackendHealth(timeoutMs = 3000): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(resolveApiUrl('/api/health'), {
      signal: controller.signal,
      cache: 'no-store',
    })
    clearTimeout(timer)
    if (!response.ok) return false
    const data = (await response.json()) as { ok?: boolean }
    const isOk = data.ok === true
    if (isOk) cachedReady = true
    return isOk
  } catch {
    clearTimeout(timer)
    return false
  }
}

/**
 * Ensures backend is awake. If already ready, returns immediately.
 * Otherwise, transitions to 'checking' -> 'waking' and polls until ready
 * or maxTimeoutMs (default 75s) expires.
 */
export async function ensureBackendAwake(
  onProgress?: (event: BackendStatusEvent) => void,
  maxTimeoutMs = 75000,
): Promise<boolean> {
  if (cachedReady) {
    onProgress?.({ state: 'ready', elapsedSeconds: 0, message: 'Backend engine ready.' })
    return true
  }

  const startTime = Date.now()
  onProgress?.({ state: 'checking', elapsedSeconds: 0, message: 'Connecting to processing engine...' })

  const quickPing = await checkBackendHealth(2500)
  if (quickPing) {
    onProgress?.({ state: 'ready', elapsedSeconds: 0, message: 'Backend engine ready.' })
    return true
  }

  // Cold start detected on free instance
  onProgress?.({
    state: 'waking',
    elapsedSeconds: 0,
    message: 'Secure processing engine is waking up. This may take up to a minute after inactivity.',
  })

  while (Date.now() - startTime < maxTimeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 2000))
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    onProgress?.({
      state: 'waking',
      elapsedSeconds: elapsed,
      message: 'Secure processing engine is waking up. This may take up to a minute after inactivity.',
    })

    const isAwake = await checkBackendHealth(2500)
    if (isAwake) {
      onProgress?.({ state: 'ready', elapsedSeconds: elapsed, message: 'Backend engine ready.' })
      return true
    }
  }

  onProgress?.({
    state: 'offline',
    elapsedSeconds: Math.round((Date.now() - startTime) / 1000),
    message: 'Server took too long to respond. Please try again.',
  })
  return false
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
  xhr.open('POST', resolveApiUrl(url))
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

export async function jobStatus(statusUrl: string): Promise<JobStatus> {
  return json(await fetch(resolveApiUrl(statusUrl)))
}

/** Cancel a job's processing without deleting its files yet. */
export async function cancelJob(jobId: string, jobToken: string): Promise<void> {
  const response = await fetch(resolveApiUrl(`/api/jobs/${jobId}/cancel?token=${encodeURIComponent(jobToken)}`), {
    method: 'POST',
  })
  if (!response.ok) throw new ApiError(response.status, 'Could not cancel the job.')
}

/** Immediately purge a job and delete all of its temporary files. */
export async function deleteJob(jobId: string, jobToken: string): Promise<boolean> {
  const response = await fetch(resolveApiUrl(`/api/jobs/${jobId}?token=${encodeURIComponent(jobToken)}`), {
    method: 'DELETE',
  })
  if (!response.ok) throw new ApiError(response.status, 'Could not delete the files.')
  return ((await response.json()) as { deleted?: boolean }).deleted === true
}

/**
 * Best-effort cleanup request for page close / unload. Uses a dedicated
 * endpoint that always returns 200 so it is safe to fire via sendBeacon.
 */
export function requestCleanup(jobId: string, jobToken: string): void {
  if (typeof window === 'undefined' || !jobId || !jobToken) return
  const url = resolveApiUrl(`/api/jobs/${jobId}/cleanup?token=${encodeURIComponent(jobToken)}`)
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url)
      return
    }
  } catch {
    // fall through to fetch
  }
  fetch(url, { method: 'POST', keepalive: true }).catch(() => undefined)
}

export async function fetchConfig(): Promise<AppConfig> {
  const response = await fetch(resolveApiUrl('/api/config'))
  return json<AppConfig>(response)
}

export async function cleanText(text: string): Promise<TextResult> {
  return json(
    await fetch(resolveApiUrl('/api/text'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),
  )
}

export async function download(url: string): Promise<void> {
  const response = await fetch(resolveApiUrl(url))
  if (!response.ok) {
    const message =
      response.status === 404
        ? 'These files have expired or already been deleted.'
        : `Download failed (${response.status})`
    throw new ApiError(response.status, message)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const quoted = disposition.match(/filename="([^"]+)"/i)?.[1]
  const filename = encoded ? decodeURIComponent(encoded) : quoted ?? 'sansmeta-download'
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
