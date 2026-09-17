interface Props {
  determinate: boolean
  fraction: number
  label: string
}

export default function ProgressBar({ determinate, fraction, label }: Props) {
  return (
    <div className="progress-wrap">
      <div className="progress-track">
        <div
          className={`progress-fill${determinate ? '' : ' indeterminate'}`}
          style={determinate ? { width: `${Math.round(Math.min(fraction, 1) * 100)}%` } : undefined}
        />
      </div>
      <span className="progress-label">{label}</span>
    </div>
  )
}
