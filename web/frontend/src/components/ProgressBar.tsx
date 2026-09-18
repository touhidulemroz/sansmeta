interface Props {
  determinate: boolean
  fraction: number
  label: string
}

export default function ProgressBar({ determinate, fraction, label }: Props) {
  const percent = determinate ? Math.round(Math.min(fraction, 1) * 100) : null

  return (
    <div className="progress-wrap">
      <div className="progress-head">
        <span className="progress-label">{label}</span>
        {percent !== null && <span className="progress-percent">{percent}%</span>}
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
      >
        <div
          className={`progress-fill${determinate ? '' : ' indeterminate'}`}
          style={determinate ? { width: `${percent}%` } : undefined}
        />
      </div>
    </div>
  )
}
