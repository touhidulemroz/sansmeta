import { useState } from 'react'
import FileDropZone from './FileDropZone'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
}

type InfoTab = 'how' | 'formats' | 'scope' | 'credits'

const TABS: { id: InfoTab; label: string }[] = [
  { id: 'how', label: 'How it works' },
  { id: 'formats', label: 'Formats' },
  { id: 'scope', label: 'Scope' },
  { id: 'credits', label: 'Credits' },
]

const STEPS = [
  { n: '01', title: 'Add files', text: 'Drop or browse images, documents, audio, video, or text.' },
  { n: '02', title: 'Inspect all', text: 'Review the hidden metadata and text marks the engine finds.' },
  { n: '03', title: 'Clean & download', text: 'Grab each cleaned copy or the whole batch as a zip.' },
]

const FEATURES = [
  { title: 'Inspect before you clean', text: 'See hidden marks per file — nothing changes without your go-ahead.' },
  { title: 'Safe batch cleaning', text: 'Originals are never modified; cleans write a new name.cleaned.ext copy.' },
  { title: 'Never overwrites', text: 'Existing exports get -2, -3 suffixes instead.' },
  { title: 'Metadata control', text: 'Keep ordinary photo metadata, or request broader removal.' },
  { title: 'Text mode', text: 'Strip invisible Unicode marks from pasted text instantly.' },
  { title: 'Private by design', text: 'No account, no tracking — files are deleted after one hour.' },
]

const FORMAT_GROUPS = [
  { name: 'Images', formats: ['PNG', 'JPEG', 'WebP', 'AVIF', 'HEIC', 'SVG'] },
  { name: 'Documents', formats: ['PDF', 'DOCX', 'XLSX', 'PPTX', 'ODT', 'EPUB', 'HTML', 'Markdown'] },
  { name: 'Audio & video', formats: ['MP4', 'MOV', 'M4A', 'MP3', 'WAV', 'FLAC'] },
  { name: 'Text & code', formats: ['TXT', 'JSON', 'CSV', 'CSS', 'JS', 'Python', 'and more'] },
]

const SCOPE = {
  removes: [
    'Supported AI provenance metadata — C2PA, EXIF, and XMP fields',
    'Hidden Unicode characters — zero-width spaces, unusual spaces, homoglyphs',
  ],
  keeps: [
    'Visible logos and watermarks drawn into the image',
    'Pixel-level SynthID watermarks',
    'Text rewriting, or guarantees that AI detectors judge content human-written',
  ],
}

export default function Landing({ onFiles, busy }: Props) {
  const [tab, setTab] = useState<InfoTab>('how')

  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">Watermarks Cleaner — web</p>
        <h2>Remove AI watermarks from your files.</h2>
        <p className="hero-sub">
          Strips C2PA, EXIF, and XMP provenance fields and hidden Unicode watermark characters.
          No account. No tracking.
        </p>
        <FileDropZone onFiles={onFiles} busy={busy}>
          <div className="drop-strip">
            <span className="drop-strip-main">
              Drop files here <em>or browse</em>
            </span>
            <span className="drop-strip-meta">50 files per batch · cleaned copies deleted after 1 h</span>
          </div>
        </FileDropZone>
        <div className="hero-meta">
          <span>Inspect first</span>
          <span>Safe copies only</span>
          <span>Engine runs on the host</span>
        </div>
      </section>

      <section className="info">
        <nav className="info-tabs" aria-label="Details">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              className={tab === entry.id ? 'active' : ''}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="info-panel">
          {tab === 'how' && (
            <div className="how-panel">
              <ol className="steps-list">
                {STEPS.map((step) => (
                  <li key={step.n}>
                    <span className="step-num">{step.n}</span>
                    <div>
                      <h4>{step.title}</h4>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <dl className="feature-list">
                {FEATURES.map((feature) => (
                  <div key={feature.title}>
                    <dt>{feature.title}</dt>
                    <dd>{feature.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {tab === 'formats' && (
            <div className="format-groups">
              {FORMAT_GROUPS.map((group) => (
                <div key={group.name} className="format-group">
                  <span className="group-name">{group.name}</span>
                  <div className="fmt-chips">
                    {group.formats.map((format) => (
                      <span key={format} className="fmt-chip">{format}</span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="note">
                Unsupported files are refused and never changed. PDF cleaning is best-effort
                without optional tools (qpdf, Ghostscript).
              </p>
            </div>
          )}
          {tab === 'scope' && (
            <div className="scope">
              <div className="scope-col">
                <h4>Removes</h4>
                <ul>
                  {SCOPE.removes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="scope-col">
                <h4>Does not</h4>
                <ul>
                  {SCOPE.keeps.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {tab === 'credits' && (
            <div className="credits">
              <p>
                Built by{' '}
                <a href="https://github.com/touhidulemroz" target="_blank" rel="noreferrer">
                  touhidulemroz
                </a>{' '}
                —{' '}
                <a
                  href="https://github.com/touhidulemroz/watermarks-cleaner-mac"
                  target="_blank"
                  rel="noreferrer"
                >
                  watermarks-cleaner-mac
                </a>
              </p>
              <p>
                Cleaning engine:{' '}
                <a
                  href="https://github.com/guillaumemeyer/watermarks-remover"
                  target="_blank"
                  rel="noreferrer"
                >
                  guillaumemeyer/watermarks-remover
                </a>{' '}
                (MIT), vendored unmodified.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
