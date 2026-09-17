import type { LocalFile } from './FilesMode'
import FileDropZone from './FileDropZone'
import FileRow from './FileRow'

interface Props {
  files: LocalFile[]
  busy: boolean
  zipUrl: string | null
  onAdd: (files: File[]) => void
  onRemove: (id: number) => void
  onClear: () => void
  onToggle: (id: number) => void
  onDownload: (item: LocalFile) => void
  onDownloadZip: () => void
}

export default function FileList({
  files,
  busy,
  zipUrl,
  onAdd,
  onRemove,
  onClear,
  onToggle,
  onDownload,
  onDownloadZip,
}: Props) {
  return (
    <div className="file-list">
      <div className="list-header">
        <span className="count">
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
        <div className="list-actions">
          {zipUrl && (
            <button className="btn small" onClick={onDownloadZip}>
              Download all (.zip)
            </button>
          )}
          {!busy && (
            <button className="btn ghost small" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>
      <FileDropZone compact busy={busy} onFiles={onAdd} />
      <div className="rows">
        {files.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            busy={busy}
            onToggle={onToggle}
            onRemove={onRemove}
            onDownload={onDownload}
          />
        ))}
      </div>
    </div>
  )
}
