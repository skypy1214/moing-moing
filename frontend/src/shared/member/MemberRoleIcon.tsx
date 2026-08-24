export type MemberRole = 'MEMBER' | 'STAFF' | 'LEADER'

export const memberRoleLabels: Record<MemberRole, string> = {
  MEMBER: '회원',
  STAFF: '운영진',
  LEADER: '모임장',
}

const memberRoleIconSources: Record<MemberRole, string> = {
  MEMBER:
    'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f464.svg',
  STAFF: 'https://api.iconify.design/mdi:sword.svg?color=%2350647a',
  LEADER: 'https://api.iconify.design/mdi:crown.svg?color=%23c88a00',
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
  return (
    <img
      alt={decorative ? '' : memberRoleLabels[role]}
      aria-hidden={decorative || undefined}
      className={`member-role-icon member-role-icon-${role.toLowerCase()} ${className}`.trim()}
      src={memberRoleIconSources[role]}
    />
  )
}
