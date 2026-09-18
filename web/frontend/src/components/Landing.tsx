import FileDropZone from './FileDropZone'
import { MAX_BATCH_FILES, MAX_FILE_MB } from '../api'
import {
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  MinusCircleIcon,
  ShieldIcon,
  UploadIcon,
} from './Icons'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
}

const FORMATS = [
  'PNG',
  'JPEG',
  'WebP',
  'HEIC',
  'PDF',
  'DOCX',
  'XLSX',
  'EPUB',
  'MP4',
  'MOV',
  'MP3',
  'WAV',
  'TXT',
  'JSON',
  'CSV',
]

const STEPS = [
  {
    n: '01',
    title: 'Inspect',
    text: 'Review hidden marks and metadata before cleaning — nothing changes yet.',
  },
  {
    n: '02',
    title: 'Clean',
    text: 'Create separate cleaned copies without ever modifying your originals.',
  },
  {
    n: '03',
    title: 'Download',
    text: 'Grab individual results or the whole batch as a single zip.',
  },
]

const HANDLES = [
  'Supported C2PA provenance information',
  'AI-related EXIF/XMP metadata',
  'Invisible Unicode characters in text',
  'Supported hidden metadata in documents, audio & video',
]

const DOES_NOT = [
  'Visible logos or graphical watermarks',
  'Pixel-level SynthID watermarks',
  'Text rewriting',
  'AI-detector classifications or guarantees',
]

export default function Landing({ onFiles, busy }: Props) {
  return (
    <div className="landing">
      <section className="hero">
        <h1>
          Clean hidden AI metadata.{' '}
          <span className="hl">Keep what matters.</span>
        </h1>
        <p className="hero-sub">
          Watermarks Cleaner removes supported C2PA and AI provenance fields and invisible
          Unicode watermark characters from images, documents, audio, video, and text —
          without ever modifying your originals.
        </p>

        <FileDropZone onFiles={onFiles} busy={busy}>
          <div className="hero-drop">
            <span className="hero-drop-icon" aria-hidden="true">
              <UploadIcon size={24} />
            </span>
            <span className="hero-drop-text">
              <strong>Drop files here</strong>
              <span>or choose files from your device</span>
            </span>
            <span className="hero-drop-btn">Choose files</span>
          </div>
        </FileDropZone>

        <p className="drop-meta">
          Up to {MAX_BATCH_FILES} files per batch · {MAX_FILE_MB} MB per file
        </p>

        <ul className="fmt-chips">
          {FORMATS.map((format) => (
            <li key={format} className="fmt-chip">
              {format}
            </li>
          ))}
          <li className="fmt-chip">+ more</li>
        </ul>

        <ul className="trust-row">
          <li>
            <LockIcon size={14} />
            No account required
          </li>
          <li>
            <ShieldIcon size={14} />
            Originals never modified
          </li>
          <li>
            <ClockIcon size={14} />
            Files deleted after 1 hour
          </li>
        </ul>
      </section>

      <section className="section" aria-labelledby="steps-heading">
        <h2 className="section-h" id="steps-heading">
          How it works
        </h2>
        <p className="section-sub">
          Everything happens on the server. You keep your originals untouched and get back
          clean, separate copies.
        </p>
        <ol className="steps-grid">
          {STEPS.map((step) => (
            <li key={step.n} className="step">
              <span className="step-num">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="scope-heading">
        <h2 className="section-h" id="scope-heading">
          What it handles — and what it doesn't
        </h2>
        <p className="section-sub">
          Honest boundaries. The engine targets supported hidden marks and metadata, not
          the pixels of a visible logo.
        </p>
        <div className="scope-grid">
          <div className="scope-col handles">
            <h3>
              <CheckCircleIcon size={17} />
              Handles
            </h3>
            <ul>
              {HANDLES.map((item) => (
                <li key={item}>
                  <CheckCircleIcon size={16} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="scope-col skips">
            <h3>
              <MinusCircleIcon size={17} />
              Does not handle
            </h3>
            <ul>
              {DOES_NOT.map((item) => (
                <li key={item}>
                  <MinusCircleIcon size={16} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
