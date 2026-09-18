import { useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent, ReactNode } from 'react'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
  compact?: boolean
  children?: ReactNode
}

export default function FileDropZone({ onFiles, busy, compact = false, children }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function openPicker() {
    if (!busy) inputRef.current?.click()
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    onFiles(Array.from(event.dataTransfer.files))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.key === 'Enter' || event.key === ' ') && !busy) {
      event.preventDefault()
      openPicker()
    }
  }

  return (
    <div
      className={`drop-zone${compact ? ' compact' : ''}${dragging ? ' dragging' : ''}${busy ? ' busy' : ''}`}
      role="button"
      tabIndex={busy ? -1 : 0}
      aria-label="Upload files"
      aria-disabled={busy}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      onDragOver={(event) => {
        event.preventDefault()
        if (!busy) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        disabled={busy}
        onChange={(event) => {
          if (event.target.files) onFiles(Array.from(event.target.files))
          event.target.value = ''
        }}
      />
      {children ?? (compact ? <span className="drop-hint">Add more files</span> : null)}
    </div>
  )
}
