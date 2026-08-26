export type Account = {
  id: string
  loginId: string
  displayName: string
  role: 'ADMIN' | 'GROUP_LEADER' | 'STAFF' | 'MEMBER'
  status: 'ACTIVE' | 'DISABLED'
}

export type ActivityLog = {
  id: string
  actorDisplayName: string | null
  action: string
  requestId: string | null
  status: number
  occurredAt: string
}

export type ActivityLogPage = {
  items: ActivityLog[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}
