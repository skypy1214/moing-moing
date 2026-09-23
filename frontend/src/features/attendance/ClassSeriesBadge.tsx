type ClassSeriesBadgeProps = {
  compact?: boolean
}

export function ClassSeriesBadge({ compact = false }: ClassSeriesBadgeProps) {
  return (
    <span className={`class-series-badge${compact ? ' is-compact' : ''}`}>
      {compact ? '연속' : '연속 수업'}
    </span>
  )
}
