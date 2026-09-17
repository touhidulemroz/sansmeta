import FileDropZone from './FileDropZone'

interface Props {
  onFiles: (files: File[]) => void
  busy: boolean
}

const FEATURES = [
  {
    icon: '◉',
    title: 'Inspect before you clean',
    text: 'See the hidden metadata and text marks the engine finds, per file — nothing changes without your go-ahead.',
  },
  {
    icon: '⇄',
    title: 'Safe batch cleaning',
    text: 'Originals are never modified. Every clean writes a new name.cleaned.ext copy.',
  },
  {
    icon: '№',
    title: 'Never overwrites',
    text: 'Existing cleaned copies are preserved — new exports get -2, -3 suffixes instead.',
  },
  {
    icon: '☑',
    title: 'Metadata control',
    text: 'Keep ordinary photo and media metadata by default, or request broader removal.',
  },
  {
    icon: 'T',
    title: 'Text mode',
    text: 'Paste text, remove invisible Unicode marks, and copy the result in seconds.',
  },
  {
    icon: '◌',
    title: 'Private by design',
    text: 'No account, no tracking. Files are processed only by the cleaning engine and deleted after one hour.',
  },
]

const STEPS = [
  { n: '1', title: 'Add files', text: 'Drop or browse images, documents, audio, video, or text.' },
  { n: '2', title: 'Inspect all', text: 'Review the hidden metadata and text marks the engine finds.' },
  { n: '3', title: 'Clean & download', text: 'Grab each cleaned copy individually or the whole batch as a zip.' },
]

const FORMAT_GROUPS = [
  { name: 'Images', formats: ['PNG', 'JPEG', 'WebP', 'AVIF', 'HEIC', 'SVG'] },
  { name: 'Documents', formats: ['PDF', 'DOCX', 'XLSX', 'PPTX', 'ODT', 'EPUB', 'HTML', 'Markdown'] },
  { name: 'Audio & video', formats: ['MP4', 'MOV', 'M4A', 'MP3', 'WAV', 'FLAC'] },
  { name: 'Text & code', formats: ['TXT', 'JSON', 'CSV', 'CSS', 'JS', 'Python', 'and more'] },
]

export default function Landing({ onFiles, busy }: Props) {
  return (
    <div className="landing">
      <FileDropZone onFiles={onFiles} busy={busy}>
        <div className="hero">
          <img className="hero-logo" src="/logo.svg" alt="" width={84} height={84} />
          <h2>Inspect &amp; remove AI watermarks</h2>
          <p className="hero-sub">
            Strip AI provenance metadata (C2PA, EXIF, XMP) and hidden watermark characters from
            your files — no account needed.
          </p>
          <div className="hero-cta">
            <span className="btn">Browse files</span>
            <span className="hint">or drag &amp; drop them here</span>
          </div>
          <span className="privacy-badge">
            <span className="dot" /> Files are deleted automatically after 1 hour
          </span>
        </div>
      </FileDropZone>

      <section className="feature-grid">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="feature-card">
            <div className="icon" aria-hidden="true">{feature.icon}</div>
            <h4>{feature.title}</h4>
            <p>{feature.text}</p>
          </div>
        ))}
      </section>

      <section className="steps">
        <h3>How it works</h3>
        <ol>
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="step-num" aria-hidden="true">{step.n}</span>
              <div>
                <h4>{step.title}</h4>
                <p>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="formats">
        <h3>Supported formats</h3>
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
        </div>
        <p className="note">
          Unsupported files are refused and never changed. PDF cleaning is best-effort without
          optional tools (qpdf, Ghostscript).
        </p>
      </section>

      <section className="scope">
        <div className="scope-col removes">
          <h4>Removes</h4>
          <ul>
            <li>Supported AI provenance metadata — C2PA, EXIF, and XMP fields</li>
            <li>Hidden Unicode characters — zero-width spaces, unusual spaces, homoglyphs</li>
          </ul>
        </div>
        <div className="scope-col keeps">
          <h4>Does not</h4>
          <ul>
            <li>Erase visible logos or watermarks drawn into the image</li>
            <li>Remove pixel-level SynthID watermarks</li>
            <li>Rewrite text or guarantee AI detectors judge content human-written</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
