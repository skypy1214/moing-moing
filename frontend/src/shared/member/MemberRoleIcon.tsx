export type MemberRole = 'MEMBER' | 'STAFF' | 'LEADER'

export const memberRoleLabels: Record<MemberRole, string> = {
  MEMBER: '회원',
  STAFF: '운영진',
  LEADER: '모임장',
}

type MemberRoleIconProps = {
  className?: string
  decorative?: boolean
  role: MemberRole
}

export function MemberRoleIcon({
  className = '',
  decorative = false,
  role,
}: MemberRoleIconProps) {
  const accessibility = decorative
    ? { 'aria-hidden': true }
    : { 'aria-label': memberRoleLabels[role], role: 'img' as const }

  return (
    <svg
      {...accessibility}
      className={`member-role-icon member-role-icon-${role.toLowerCase()} ${className}`.trim()}
      fill="none"
      viewBox="0 0 24 24"
    >
      {role === 'MEMBER' && (
        <>
          <circle cx="12" cy="8" fill="currentColor" r="4" />
          <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill="currentColor" />
        </>
      )}
      {role === 'STAFF' && (
        <path
          d="m14.8 3.2 6 6-3.1 3.1-2.2-2.2-6.9 6.9 1.4 1.4-1.4 1.4-2.8-2.8-1.4 1.4-1.4-1.4 1.4-1.4-2.8-2.8 1.4-1.4 1.4 1.4 6.9-6.9-2.2-2.2 3.1-3.1Z"
          fill="currentColor"
        />
      )}
      {role === 'LEADER' && (
        <path
          d="m3 6 4.5 3L12 3l4.5 6L21 6l-2 12H5L3 6Zm3.2 9h11.6l.4-2.5-3.1 1-3.1-4.2-3.1 4.2-3.1-1 .4 2.5Z"
          fill="currentColor"
        />
      )}
    </svg>
  )
}
