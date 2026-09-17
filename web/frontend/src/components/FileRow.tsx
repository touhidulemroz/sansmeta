import type { LocalFile } from './FilesMode'
import ReportView from './ReportView'
import { formatBytes } from '../api'

interface Props {
  item: LocalFile
  busy: boolean
  onToggle: (id: number) => void
  onRemove: (id: number) => void
  onDownload: (item: LocalFile) => void
}

const STATUS_LABEL: Record<LocalFile['status'], string> = {
  idle: 'Ready',
  busy: 'Working…',
  clean: 'Done',
  warning: 'Review',
  failed: 'Failed',
  stopped: 'Stopped',
}

export default function FileRow({ item, busy, onToggle, onRemove, onDownload }: Props) {
  return (
    <div className={`file-row status-${item.status}`}>
      <div className="file-line">
        <button
          className="expand"
          onClick={() => onToggle(item.id)}
          disabled={!item.report}
          aria-label={item.expanded ? 'Collapse report' : 'Expand report'}
        >
          {item.expanded ? '▾' : '▸'}
        </button>
        <div className="file-main">
          <div className="file-name" title={item.name}>
            {item.name}
          </div>
          <div className="file-meta">
            <span className={`chip ${item.status}`}>{STATUS_LABEL[item.status]}</span>
            <span className="size">{formatBytes(item.size)}</span>
            {item.summary && <span className="summary">{item.summary}</span>}
          </div>
        </div>
        <div className="file-actions">
          {item.downloadUrl && (
            <button className="btn small" onClick={() => onDownload(item)}>
              Download
            </button>
          )}
          {!busy && (
            <button
              className="icon-btn"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name}`}
            >
              ✕
            </button>
          )}
        </div>
      </div>
      {item.expanded && item.report && <ReportView report={item.report} />}
    </div>
  )
}
