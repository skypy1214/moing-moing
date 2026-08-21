type EmptyStateProps = {
  description: string
  icon?: string
  title?: string
}

export function EmptyState({
  description,
  icon = '○',
  title = '아직 표시할 내용이 없습니다',
}: EmptyStateProps) {
  return (
    <div className="empty-state empty-state-card">
      <span aria-hidden="true" className="empty-state-icon">
        {icon}
      </span>
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  )
}
