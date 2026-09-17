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

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    if (busy) return
    onFiles(Array.from(event.dataTransfer.files))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && !busy) inputRef.current?.click()
  }

  return (
    <div
      className={`drop-zone${compact ? ' compact' : ''}${dragging ? ' dragging' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!busy) inputRef.current?.click()
      }}
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
        onChange={(event) => {
          if (event.target.files) onFiles(Array.from(event.target.files))
          event.target.value = ''
        }}
      />
      {children ?? (compact ? <span className="drop-hint">Drop more files or click to browse</span> : null)}
    </div>
  )
}
