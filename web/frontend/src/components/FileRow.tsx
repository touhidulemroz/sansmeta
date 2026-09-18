import type { ReactNode } from 'react'
import type { LocalFile } from './FilesMode'
import ReportView from './ReportView'
import { formatBytes } from '../api'
import {
  AudioIcon,
  ChevronIcon,
  DocIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  TextFileIcon,
  VideoIcon,
  XIcon,
} from './Icons'

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

type FileKind = 'image' | 'doc' | 'audio' | 'video' | 'text' | 'file'

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'avif', 'heic', 'heif', 'svg', 'gif', 'bmp', 'tif', 'tiff']
const DOC_EXT = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'epub', 'html', 'htm']
const AUDIO_EXT = ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac', 'aiff']
const VIDEO_EXT = ['mp4', 'mov', 'mkv', 'webm', 'avi', 'm4v']

function fileKind(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (IMAGE_EXT.includes(ext)) return 'image'
  if (DOC_EXT.includes(ext)) return 'doc'
  if (AUDIO_EXT.includes(ext)) return 'audio'
  if (VIDEO_EXT.includes(ext)) return 'video'
  if (ext && ext !== name.toLowerCase()) return 'text'
  return 'file'
}

const KIND_ICON: Record<FileKind, (props: { size?: number }) => ReactNode> = {
  image: (props) => <ImageIcon {...props} />,
  doc: (props) => <DocIcon {...props} />,
  audio: (props) => <AudioIcon {...props} />,
  video: (props) => <VideoIcon {...props} />,
  text: (props) => <TextFileIcon {...props} />,
  file: (props) => <FileIcon {...props} />,
}

export default function FileRow({ item, busy, onToggle, onRemove, onDownload }: Props) {
  const kind = fileKind(item.name)
  const KindIcon = KIND_ICON[kind]
  const reportId = `report-${item.id}`

  return (
    <div className={`file-row status-${item.status}`}>
      <div className="file-line">
        <button
          className="expand"
          onClick={() => onToggle(item.id)}
          disabled={!item.report}
          aria-expanded={item.expanded}
          aria-controls={reportId}
          aria-label={item.expanded ? `Collapse report for ${item.name}` : `Expand report for ${item.name}`}
        >
          <ChevronIcon size={15} direction={item.expanded ? 'down' : 'right'} />
        </button>
        <span className="file-kind" aria-hidden="true">
          <KindIcon size={17} />
        </span>
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
              <DownloadIcon size={14} />
              Download
            </button>
          )}
          {!busy && (
            <button
              className="icon-btn"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.name}`}
            >
              <XIcon size={16} />
            </button>
          )}
        </div>
      </div>
      {item.expanded && item.report && (
        <div id={reportId}>
          <ReportView report={item.report} />
        </div>
      )}
    </div>
  )
}
