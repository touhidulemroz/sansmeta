interface Props {
  report: Record<string, unknown>
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function RenderValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="nil">—</span>
  if (typeof value === 'boolean') return <span>{value ? 'yes' : 'no'}</span>
  if (typeof value === 'number' || typeof value === 'string') {
    return <span>{String(value)}</span>
  }
  if (Array.isArray(value)) {
    return (
      <ul className="report-list">
        {value.map((entry, index) => (
          <li key={index}>
            {typeof entry === 'object' && entry !== null ? (
              <ReportSection data={entry as Record<string, unknown>} />
            ) : (
              <RenderValue value={entry} />
            )}
          </li>
        ))}
      </ul>
    )
  }
  return <ReportSection data={value as Record<string, unknown>} />
}

function ReportSection({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data)
  if (entries.length === 0) return <span className="nil">—</span>
  return (
    <dl className="report-kv">
      {entries.map(([key, value]) => (
        <div key={key} className="kv-row">
          <dt>{humanize(key)}</dt>
          <dd>
            <RenderValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function ReportView({ report }: Props) {
  return (
    <div className="report">
      <div className="report-title">Technical report</div>
      <ReportSection data={report} />
    </div>
  )
}
