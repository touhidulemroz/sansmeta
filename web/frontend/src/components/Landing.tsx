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
  { title: 'Add files', text: 'Drop or browse images, documents, audio, video, or text.' },
  { title: 'Inspect', text: 'See every hidden mark the engine finds — nothing changes yet.' },
  { title: 'Clean & download', text: 'Grab each cleaned copy, or the whole batch as a zip.' },
]

const FEATURES = [
  { title: 'Inspect first', text: 'Preview hidden marks before anything is touched.' },
  { title: 'Safe copies only', text: 'Originals are never modified.' },
  { title: 'Never overwrites', text: 'Existing exports get -2, -3 suffixes.' },
  { title: 'Metadata control', text: 'Keep normal metadata, or strip more.' },
  { title: 'Text mode', text: 'Paste text and strip invisible marks instantly.' },
  { title: 'Private', text: 'No account. Files deleted after one hour.' },
]

const FORMAT_GROUPS = [
  { name: 'Images', formats: ['PNG', 'JPEG', 'WebP', 'AVIF', 'HEIC', 'SVG'] },
  { name: 'Documents', formats: ['PDF', 'DOCX', 'XLSX', 'PPTX', 'ODT', 'EPUB', 'HTML'] },
  { name: 'Audio & video', formats: ['MP4', 'MOV', 'M4A', 'MP3', 'WAV'] },
  { name: 'Text & code', formats: ['TXT', 'JSON', 'CSV', 'CSS', 'JS', 'MD'] },
]

const SCOPE = {
  removes: [
    'AI provenance metadata — C2PA, EXIF, and XMP fields',
    'Hidden Unicode characters — zero-width spaces, homoglyphs',
  ],
  keeps: [
    'Visible logos and watermarks drawn into the image',
    'Pixel-level SynthID watermarks',
    'Text rewriting, or AI-detector guarantees',
  ],
}

export default function Landing({ onFiles, busy }: Props) {
  const [tab, setTab] = useState<InfoTab>('how')

  return (
    <div className="landing">
      <section className="hero">
        <p className="eyebrow">Watermarks Cleaner · web</p>
        <h1>
          Remove AI <span className="accent">watermarks</span> in seconds.
        </h1>
        <p className="hero-sub">
          Strip C2PA, EXIF, and XMP provenance and hidden Unicode marks from images,
          documents, audio, and video. No account needed.
        </p>

        <FileDropZone onFiles={onFiles} busy={busy}>
          <div className="hero-drop">
            <div className="hero-drop-icon" aria-hidden="true">＋</div>
            <div className="hero-drop-text">
              <strong>Drop your files here</strong>
              <span>or click to browse · up to 50 files per batch</span>
            </div>
          </div>
        </FileDropZone>

        <div className="hero-chips">
          <span>Batch processing</span>
          <span>100 MB per file</span>
          <span>Deletes after 1 h</span>
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
                  <li key={step.title}>
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
              <p className="note">Unsupported files are refused and never changed.</p>
            </div>
          )}

          {tab === 'scope' && (
            <div className="scope">
              <div className="scope-col">
                <h4>Removes</h4>
                <ul>{SCOPE.removes.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="scope-col">
                <h4>Does not</h4>
                <ul>{SCOPE.keeps.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          )}

          {tab === 'credits' && (
            <div className="credits">
              <p>
                Built by{' '}
                <a href="https://github.com/touhidulemroz" target="_blank" rel="noreferrer">touhidulemroz</a>
                {' — '}
                <a href="https://github.com/touhidulemroz/watermarks-cleaner-mac" target="_blank" rel="noreferrer">
                  watermarks-cleaner-mac
                </a>
              </p>
              <p>
                Cleaning engine:{' '}
                <a href="https://github.com/guillaumemeyer/watermarks-remover" target="_blank" rel="noreferrer">
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
