import type { LocalFile } from './FilesMode'
import FileDropZone from './FileDropZone'
import FileRow from './FileRow'
import { PlusIcon } from './Icons'

interface Props {
  files: LocalFile[]
  busy: boolean
  onAdd: (files: File[]) => void
  onRemove: (id: number) => void
  onToggle: (id: number) => void
  onDownload: (item: LocalFile) => void
}

export default function FileList({ files, busy, onAdd, onRemove, onToggle, onDownload }: Props) {
  return (
    <div className="file-list">
      <FileDropZone compact busy={busy} onFiles={onAdd}>
        <span className="drop-hint">
          <PlusIcon size={15} />
          Add more files
        </span>
      </FileDropZone>
      <ul className="rows">
        {files.map((item) => (
          <li key={item.id}>
            <FileRow
              item={item}
              busy={busy}
              onToggle={onToggle}
              onRemove={onRemove}
              onDownload={onDownload}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
