import type { ReactNode } from 'react'
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
  onUseText: () => void
  busy: boolean
  fallbackMinutes: number
  notice?: ReactNode
  workspace?: ReactNode
}

const FORMAT_GROUPS = [
  {
    title: 'Images',
    items: 'PNG, JPEG, WebP, AVIF, HEIC/HEIF, SVG',
  },
  {
    title: 'Documents',
    items: 'PDF, DOCX, XLSX, PPTX, EPUB, HTML, Markdown',
  },
  {
    title: 'Audio',
    items: 'MP3, WAV, M4A, FLAC, OGG, AAC, AIFF',
  },
  {
    title: 'Video',
    items: 'MP4, MOV, MKV, WEBM, AVI, M4V',
  },
  {
    title: 'Text',
    items: 'TXT, JSON, CSV — plus pasted text',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Select',
    text: 'Add up to 50 files, or switch to Text mode and paste text.',
  },
  {
    n: '02',
    title: 'Inspect',
    text: 'See the hidden metadata and invisible characters found in each file — nothing changes yet.',
  },
  {
    n: '03',
    title: 'Clean',
    text: 'The server writes separate cleaned copies. Your originals are never touched.',
  },
  {
    n: '04',
    title: 'Download',
    text: 'Download individual results or the whole batch as one zip.',
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
  'Pixel-level watermarks (for example, SynthID)',
  'Text rewriting',
  'AI-detector classifications or guarantees',
]

const TERMS = [
  {
    term: 'Hidden metadata',
    text: 'Data attached to a file but not part of what you see — provenance, camera, and software fields stored as C2PA, EXIF, or XMP. SansMeta inspects and cleans the supported ones.',
  },
  {
    term: 'Invisible Unicode characters',
    text: 'Characters with no visible glyph, such as zero-width spaces, that sit inside text. They are sometimes used for text watermarking, but not every invisible character is AI-generated — SansMeta removes the supported ones regardless of origin.',
  },
  {
    term: 'Visible watermarks',
    text: 'Logos or text drawn into the picture itself. Removing them means editing pixels, which SansMeta does not do.',
  },
  {
    term: 'Pixel-level watermarks',
    text: 'Imperceptible changes woven into the image\u2019s pixels, such as SynthID. They cannot be removed by metadata cleaning, and SansMeta does not claim to remove them.',
  },
]

const FAQ = [
  {
    question: 'What does SansMeta remove?',
    answer:
      'SansMeta removes supported hidden metadata — C2PA provenance and AI-related EXIF/XMP fields — from supported files, and strips supported invisible Unicode characters such as zero-width spaces from pasted text. It creates cleaned copies and never modifies your originals.',
  },
  {
    question: 'Will it remove a visible watermark or logo?',
    answer:
      'No. SansMeta does not edit pixels. Visible watermarks and logos are part of the image itself and are left untouched.',
  },
  {
    question: 'What is the difference between hidden metadata and a visible watermark?',
    answer:
      'Hidden metadata is data attached to a file — provenance, camera, or software fields — that you cannot see when viewing the file. A visible watermark is drawn into the picture. SansMeta cleans the former, not the latter.',
  },
  {
    question: 'Can it remove pixel-level watermarks like SynthID?',
    answer:
      'No. Pixel-level watermarks modify image pixels in ways metadata cleaning cannot address. SansMeta does not claim to remove them.',
  },
  {
    question: 'How long are my files kept?',
    answer:
      'Temporary files are deleted after a completed download, when you start over, or when you choose Delete files. If immediate deletion cannot be confirmed, the configured fallback expires them automatically within the period shown on this page.',
  },
  {
    question: 'Are my files private?',
    answer:
      'Files are processed on the server and stored only in temporary workspaces. No account is required. Each job is protected by a separate random access token. Anyone with the complete download link can use it while the job exists, so do not share it.',
  },
  {
    question: 'Which formats are supported?',
    answer:
      'Images such as PNG, JPEG, WebP, AVIF and HEIC; documents such as PDF, DOCX, XLSX, PPTX, EPUB, HTML and Markdown; audio such as MP3, WAV, M4A and FLAC; video such as MP4, MOV, MKV and WEBM; and plain-text formats such as TXT, JSON and CSV. Some formats, like PDFs, are cleaned best-effort depending on the tools installed on the server.',
  },
  {
    question: 'Will cleaning bypass AI detectors?',
    answer:
      'No. SansMeta removes supported metadata and hidden characters. It does not rewrite content, does not remove platform AI labels, and makes no guarantee about how AI detectors will classify a file.',
  },
  {
    question: 'Is it free? Do I need an account?',
    answer: 'Yes, SansMeta is free to use and requires no account.',
  },
]

export default function Landing({
  onFiles,
  onUseText,
  busy,
  fallbackMinutes,
  notice,
  workspace,
}: Props) {
  return (
    <div className="landing">
      <section className="hero" aria-labelledby="hero-heading">
        <p className="eyebrow">Remove Hidden AI Metadata Online for Free</p>
        <h1 id="hero-heading">
          Inspect and clean hidden AI metadata in your files.{' '}
          <span className="hl">Online, for free.</span>
        </h1>
        <p className="hero-sub">
          SansMeta removes supported AI provenance fields — C2PA, EXIF, XMP — and invisible
          Unicode characters from images, documents, audio, video, and text. Your originals
          are never modified; you get separate cleaned copies to download.
        </p>

        {notice}
        {workspace ?? (
          <>
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
            <button className="text-mode-link" onClick={onUseText}>
              Prefer text? Clean invisible characters from pasted text instead
            </button>

            <div className="hero-trust-bar">
              <span className="trust-pill"><LockIcon size={13} /> No account</span>
              <span className="trust-pill"><ShieldIcon size={13} /> Originals untouched</span>
              <span className="trust-pill"><ClockIcon size={13} /> Auto-purged in {fallbackMinutes}m</span>
              <span className="trust-sep">·</span>
              <span className="trust-meta">Up to {MAX_BATCH_FILES} files ({MAX_FILE_MB}MB ea)</span>
            </div>
          </>
        )}
      </section>

      <section className="section" id="how-it-works" aria-labelledby="steps-heading">
        <h2 className="section-h" id="steps-heading">
          How it works
        </h2>
        <p className="section-sub">
          Processing happens on the server, not in your browser. You keep your originals
          untouched and get back clean, separate copies.
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

      <section className="section" id="formats" aria-labelledby="formats-heading">
        <h2 className="section-h" id="formats-heading">
          Supported formats
        </h2>
        <p className="section-sub">
          Hidden metadata is cleaned where the engine supports the format — with honest
          limits.
        </p>
        <ul className="format-grid">
          {FORMAT_GROUPS.map((group) => (
            <li key={group.title} className="format-card">
              <h3>{group.title}</h3>
              <p>{group.items}</p>
            </li>
          ))}
        </ul>
        <p className="formats-note">
          Cleaning quality depends on the format and the tools installed on the server. PDFs
          are cleaned best-effort when optional tools (qpdf, exiftool, Ghostscript) are
          unavailable. Files with residual marks are flagged for review, and unsupported
          formats are refused rather than altered.
        </p>
      </section>

      <section className="section" id="scope" aria-labelledby="scope-heading">
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-h" id="scope-heading">
              Scope &amp; Capabilities
            </h2>
            <p className="section-sub">
              Honest boundaries. SansMeta targets supported hidden marks and metadata, not visible pixels.
            </p>
          </div>

          <div className="scope-grid">
            <div className="scope-col handles">
              <h3>
                <CheckCircleIcon size={17} />
                Supported &amp; Cleaned
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
                Out of Scope
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

          <details className="terminology-accordion">
            <summary>
              <span>Learn the technical difference: Metadata vs. Watermarks</span>
            </summary>
            <div className="terminology-content">
              <dl className="terms-list">
                {TERMS.map((item) => (
                  <div key={item.term} className="term-item">
                    <dt>{item.term}</dt>
                    <dd>{item.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </details>
        </div>
      </section>

      <section className="section" id="privacy" aria-labelledby="privacy-heading">
        <div className="section-card">
          <div className="section-card-header">
            <h2 className="section-h" id="privacy-heading">
              Privacy &amp; Ephemeral Lifecycle
            </h2>
            <p className="section-sub">
              Your files exist only as long as needed to inspect and clean them. No accounts, no persistent tracking.
            </p>
          </div>

          <div className="privacy-card-grid">
            <div className="privacy-mini-card">
              <span className="privacy-mini-icon"><ShieldIcon size={18} /></span>
              <h4>Server Processing</h4>
              <p>Files are securely processed server-side with zero permanent retention. Originals remain untouched.</p>
            </div>
            <div className="privacy-mini-card">
              <span className="privacy-mini-icon"><LockIcon size={18} /></span>
              <h4>No Accounts</h4>
              <p>No registration, passwords, or cookies required. Access via one-time secure job tokens.</p>
            </div>
            <div className="privacy-mini-card">
              <span className="privacy-mini-icon"><ClockIcon size={18} /></span>
              <h4>Auto-Purge ({fallbackMinutes}m)</h4>
              <p>Deleted immediately upon download or when the session closes; hard-expired within {fallbackMinutes}m.</p>
            </div>
          </div>

          <p className="section-cta">
            <a href="/privacy/">Read our comprehensive Privacy Policy &rarr;</a>
          </p>
        </div>
      </section>

      <section className="section" id="faq" aria-labelledby="faq-heading">
        <h2 className="section-h" id="faq-heading">
          Frequently asked questions
        </h2>
        <div className="faq-list">
          {FAQ.map((item) => (
            <details key={item.question} className="faq-item">
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
