import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { flushSync } from 'react-dom'

import { AttendancePage } from './features/attendance/AttendancePage'
import { CouponPage } from './features/coupon/CouponPage'
import {
  MemberProfileForm,
  type MemberRole as MemberProfileRole,
} from './features/member/MemberProfileForm'
import { MemberParticipationHistory } from './features/member/MemberParticipationHistory'
import { MeetingNotePage } from './features/meetingnote/MeetingNotePage'
import { MonthlyStatisticsPage } from './features/statistics/MonthlyStatisticsPage'
import { OperationsPage } from './features/operations/OperationsPage'
import {
  MemberRoleIcon,
  memberRoleLabels,
} from './shared/member/MemberRoleIcon'
import {
  apiFetch as fetch,
  apiBaseUrl,
  apiLoadingChangeEvent,
  apiUnauthorizedEvent,
  isApiLoading,
} from './shared/api/apiFetch'
import { useFeedbackDialog } from './shared/feedback-dialog/useFeedbackDialog'
import { FeedbackMessageDialog } from './shared/feedback-dialog/FeedbackMessageDialog'
import { BottomNav } from './shared/ui/BottomNav'
import { EmptyState } from './shared/ui/EmptyState'
import { KoreanDateInput, formatKoreanDate } from './shared/ui/KoreanDateInput'
import { Modal } from './shared/ui/Modal'
import { RefreshIcon } from './shared/ui/RefreshIcon'
import { ScrollTopIcon } from './shared/ui/ScrollTopIcon'
import { SettingsIcon } from './shared/ui/SettingsIcon'
import { useEscapeKey } from './shared/ui/useEscapeKey'
import { Button, Card } from './shared/ui/ui'
import { SelectField } from './shared/ui/SelectField'
import './App.css'

export type Member = {
  id: string
  displayName: string
  externalNickname: string | null
  membershipStatus: 'ACTIVE' | 'WITHDRAWN'
  memberRole: 'MEMBER' | 'STAFF' | 'LEADER'
  joinedOn: string
  withdrawnOn: string | null
  memo: string | null
  lastAttendanceOn?: string | null
  activityPaused?: boolean
}

type ActivityExclusionReason =
  'PERSONAL_BREAK' | 'MEDICAL' | 'MILITARY_SERVICE' | 'OTHER'

type ActivityExclusion = {
  id: string
  reason: ActivityExclusionReason
  startDate: string
  endDate: string | null
  note: string | null
}

type ApiErrorResponse = {
  message?: string
  fieldErrors?: Record<string, string>
}

type AuthAccount = {
  displayName: string
  isAdmin: boolean
  loginId: string
}

type ActivityFilter = 'ALL' | 'ACTIVE' | 'PAUSED'
type SortDirection = 'ASC' | 'DESC' | null
type MemberRole = Member['memberRole']
type PageKey =
  | 'MEMBERS'
  | 'ATTENDANCE'
  | 'COUPONS'
  | 'STATISTICS'
  | 'MEETING_NOTES'
  | 'OPERATIONS'

type BackendStatus = 'CHECKING' | 'READY' | 'UNAVAILABLE'

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => void
}

const today = new Date().toISOString().slice(0, 10)
const healthCheckTimeoutMs = 10_000
const healthCheckRetryDelayMs = 5_000

const activityExclusionReasonLabels: Record<ActivityExclusionReason, string> = {
  PERSONAL_BREAK: '개인 사정',
  MEDICAL: '건강/치료',
  MILITARY_SERVICE: '군 복무',
  OTHER: '기타',
}

const memberRolePriority: Record<MemberRole, number> = {
  LEADER: 0,
  STAFF: 1,
  MEMBER: 2,
}

type InactivityBadge = {
  label: string
  tone: 'new-member' | 'inactive' | '1' | '2' | '3'
}

function isActivityExclusionActive(exclusion: ActivityExclusion) {
  return (
    exclusion.startDate <= today &&
    (exclusion.endDate === null || exclusion.endDate >= today)
  )
}

function getInactivityBadge(member: Member): InactivityBadge | null {
  if (
    member.membershipStatus !== 'ACTIVE' ||
    member.lastAttendanceOn === undefined
  ) {
    return null
  }

  const now = new Date()
  const referenceDate = new Date(
    `${member.lastAttendanceOn ?? member.joinedOn}T00:00:00`,
  )
  if (Number.isNaN(referenceDate.getTime()) || referenceDate > now) {
    return null
  }

  if (member.lastAttendanceOn === null) {
    const threeMonthsAfterJoining = new Date(referenceDate)
    threeMonthsAfterJoining.setMonth(threeMonthsAfterJoining.getMonth() + 3)
    return threeMonthsAfterJoining > now
      ? { label: '🌱 새싹 회원', tone: 'new-member' }
      : { label: '미활동자', tone: 'inactive' }
  }

  const oneMonthLater = new Date(referenceDate)
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1)
  if (oneMonthLater > now) {
    return null
  }

  const twoMonthsLater = new Date(referenceDate)
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)
  if (twoMonthsLater > now) {
    return { label: '1개월 미출석', tone: '1' }
  }

  const threeMonthsLater = new Date(referenceDate)
  threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3)
  if (threeMonthsLater > now) {
    return { label: '2개월 미출석', tone: '2' }
  }

  return { label: '3개월 이상 미출석', tone: '3' }
}

function subscribeToApiLoading(listener: () => void) {
  window.addEventListener(apiLoadingChangeEvent, listener)
  return () => window.removeEventListener(apiLoadingChangeEvent, listener)
}

function App() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [currentLoginId, setCurrentLoginId] = useState<string | null>(null)
  const [currentDisplayName, setCurrentDisplayName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('CHECKING')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isOwnPasswordModalOpen, setIsOwnPasswordModalOpen] = useState(false)
  const [ownDisplayName, setOwnDisplayName] = useState('')
  const [ownPassword, setOwnPassword] = useState('')
  const [ownPasswordConfirmation, setOwnPasswordConfirmation] = useState('')
  const isRequestInProgress = useSyncExternalStore(
    subscribeToApiLoading,
    isApiLoading,
    () => false,
  )
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isMemberSheetOpen, setIsMemberSheetOpen] = useState(false)
  const [isMemberDetailPage, setIsMemberDetailPage] = useState(false)
  const [isMemberParticipationPage, setIsMemberParticipationPage] =
    useState(false)
  const [isMemberCreatePage, setIsMemberCreatePage] = useState(false)
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false)
  const [isActivityExclusionModalOpen, setIsActivityExclusionModalOpen] =
    useState(false)
  const [exclusions, setExclusions] = useState<ActivityExclusion[]>([])
  const [isLoadingExclusions, setIsLoadingExclusions] = useState(false)
  const [editingExclusion, setEditingExclusion] =
    useState<ActivityExclusion | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [externalNickname, setExternalNickname] = useState('')
  const [joinedOn, setJoinedOn] = useState(today)
  const [memo, setMemo] = useState('')
  const [memberRole, setMemberRole] = useState<MemberRole>('MEMBER')
  const [membershipDate, setMembershipDate] = useState(today)
  const [exclusionReason, setExclusionReason] =
    useState<ActivityExclusionReason>('PERSONAL_BREAK')
  const [exclusionStartDate, setExclusionStartDate] = useState(today)
  const [exclusionNote, setExclusionNote] = useState('')
  const [exclusionEndDate, setExclusionEndDate] = useState(today)
  const [isExclusionEndDateSet, setIsExclusionEndDateSet] = useState(false)
  const [message, setMessage] = useState('')
  const { confirm, showFeedbackDialog } = useFeedbackDialog()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [memberSearch, setMemberSearch] = useState('')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL')
  const [nameSortDirection, setNameSortDirection] =
    useState<SortDirection>(null)
  const [joinedOnSortDirection, setJoinedOnSortDirection] =
    useState<SortDirection>('DESC')
  const [currentPage, setCurrentPage] = useState<PageKey>('MEMBERS')
  const canManage = currentLoginId !== null

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentLoginId(null)
      setCurrentDisplayName('')
      setIsAdmin(false)
      setMembers([])
      setSelectedMember(null)
      setMessage('서버 세션이 만료되어 자동으로 로그아웃되었습니다.')
    }
    window.addEventListener(apiUnauthorizedEvent, handleUnauthorized)
    return () =>
      window.removeEventListener(apiUnauthorizedEvent, handleUnauthorized)
  }, [])

  const navigationItems = [
    { value: 'MEMBERS', label: '회원', desktopLabel: '회원 관리', icon: '♙' },
    {
      value: 'ATTENDANCE',
      label: '출석',
      desktopLabel: '출석 관리',
      icon: '✓',
    },
    { value: 'COUPONS', label: '쿠폰', desktopLabel: '쿠폰 관리', icon: '◇' },
    {
      value: 'STATISTICS',
      label: '통계',
      desktopLabel: '월별 통계',
      icon: '▥',
    },
    {
      value: 'MEETING_NOTES',
      label: '게시판',
      desktopLabel: '게시판',
      icon: '☰',
    },
    ...(isAdmin
      ? [
          {
            value: 'OPERATIONS' as const,
            label: '운영',
            desktopLabel: '운영 관리',
            icon: '⚙',
          },
        ]
      : []),
  ] satisfies {
    value: PageKey
    label: string
    desktopLabel: string
    icon: string
  }[]

  const visibleMembers = useMemo(() => {
    const normalizedSearch = memberSearch.trim().toLocaleLowerCase()
    return [...members]
      .filter((member) => member.membershipStatus === 'ACTIVE')
      .filter(
        (member) =>
          activityFilter === 'ALL' ||
          (activityFilter === 'PAUSED'
            ? member.activityPaused
            : !member.activityPaused),
      )
      .filter((member) => {
        if (normalizedSearch === '') {
          return true
        }
        return [member.displayName, member.externalNickname]
          .filter((value): value is string => value !== null)
          .some((value) => value.toLocaleLowerCase().includes(normalizedSearch))
      })
      .sort((left, right) => {
        const roleDifference =
          memberRolePriority[left.memberRole] -
          memberRolePriority[right.memberRole]
        if (roleDifference !== 0) {
          return roleDifference
        }
        if (left.memberRole !== 'MEMBER') {
          return 0
        }
        if (joinedOnSortDirection !== null) {
          const comparison = left.joinedOn.localeCompare(right.joinedOn)
          return joinedOnSortDirection === 'ASC' ? comparison : -comparison
        }
        const comparison = left.displayName.localeCompare(
          right.displayName,
          'ko',
        )
        return nameSortDirection === 'DESC' ? -comparison : comparison
      })
  }, [
    activityFilter,
    joinedOnSortDirection,
    memberSearch,
    members,
    nameSortDirection,
  ])

  const isSelectedMemberActivityPaused =
    selectedMember?.activityPaused === true ||
    exclusions.some(isActivityExclusionActive)

  function nextSortDirection(direction: SortDirection): SortDirection {
    return direction === null ? 'ASC' : direction === 'ASC' ? 'DESC' : null
  }

  const loadMembers = useCallback(async () => {
    const response = await fetch('/api/v1/members', { credentials: 'include' })
    if (!response.ok) {
      throw new Error('회원 목록을 불러오지 못했습니다.')
    }
    setMembers((await response.json()) as Member[])
  }, [])

  function navigateToPage(nextPage: PageKey) {
    if (nextPage === 'MEMBERS' && currentLoginId !== null) {
      void loadMembers().catch(() =>
        setMessage('회원 목록을 불러오지 못했습니다.'),
      )
    }

    if (nextPage === currentPage) {
      return
    }

    const documentWithViewTransition = document as DocumentWithViewTransition
    if (documentWithViewTransition.startViewTransition) {
      documentWithViewTransition.startViewTransition(() => {
        flushSync(() => {
          setCurrentPage(nextPage)
        })
      })
      return
    }
    setCurrentPage(nextPage)
  }

  useEffect(() => {
    let isDisposed = false
    let retryTimer: number | undefined

    async function checkBackendHealth() {
      const controller = new AbortController()
      const timeoutTimer = window.setTimeout(
        () => controller.abort(),
        healthCheckTimeoutMs,
      )

      try {
        const response = await globalThis.fetch(`${apiBaseUrl}/api/v1/ready`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error('백엔드 상태 확인에 실패했습니다.')
        }
        if (!isDisposed) {
          setBackendStatus('READY')
        }
      } catch {
        if (!isDisposed) {
          setBackendStatus('UNAVAILABLE')
          retryTimer = window.setTimeout(
            () => void checkBackendHealth(),
            healthCheckRetryDelayMs,
          )
        }
      } finally {
        window.clearTimeout(timeoutTimer)
      }
    }

    void checkBackendHealth()
    return () => {
      isDisposed = true
      window.clearTimeout(retryTimer)
    }
  }, [])

  const restoreSession = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/auth/me', {
        credentials: 'include',
      })
      if (!response.ok) {
        return
      }

      const account = (await response.json()) as AuthAccount
      setCurrentLoginId(account.loginId)
      setCurrentDisplayName(account.displayName)
      setIsAdmin(account.isAdmin)
      setCurrentPage('MEMBERS')
      await loadMembers()
    } catch {
      setMessage('서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.')
    }
  }, [loadMembers])

  async function applyApiError(response: Response, fallbackMessage: string) {
    const error = (await response
      .json()
      .catch(() => null)) as ApiErrorResponse | null
    setFieldErrors(error?.fieldErrors ?? {})
    const errorMessage = error?.message ?? fallbackMessage
    return errorMessage
  }

  useEffect(() => {
    if (backendStatus !== 'READY') {
      return
    }

    // Session restoration starts only after the public health endpoint confirms the API is ready.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restoreSession()
  }, [backendStatus, restoreSession])

  useEffect(() => {
    if (
      !isMemberSheetOpen &&
      !isMembershipModalOpen &&
      !isActivityExclusionModalOpen
    ) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isActivityExclusionModalOpen, isMemberSheetOpen, isMembershipModalOpen])

  useEscapeKey(
    () => setIsMemberSheetOpen(false),
    isMemberSheetOpen &&
      !isMembershipModalOpen &&
      !isActivityExclusionModalOpen,
  )

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (backendStatus !== 'READY' || isAuthenticating) {
      return
    }
    setMessage('')
    setIsAuthenticating(true)

    try {
      const body = new URLSearchParams({ username: loginId, password })
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        body,
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      if (!response.ok) {
        setMessage('로그인 ID 또는 비밀번호를 확인해 주세요.')
        return
      }

      setPassword('')
      // The login response only confirms authentication. Fetch the session profile
      // before rendering the app so non-admin accounts never briefly receive admin UI.
      await restoreSession()
    } catch {
      setMessage(
        '로그인 요청을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setIsAuthenticating(false)
    }
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) {
      return
    }
    setMessage('')
    setFieldErrors({})

    const response = await fetch('/api/v1/members', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName,
        externalNickname: externalNickname || null,
        joinedOn,
        memo: memo || null,
        memberRole,
      }),
    })

    if (!response.ok) {
      const errorMessage = await applyApiError(
        response,
        '회원 등록에 실패했습니다. 입력값을 확인해 주세요.',
      )
      showFeedbackDialog({ title: '회원 등록 실패', message: errorMessage })
      return
    }

    const createdMember = (await response.json()) as Member
    if (createdMember.memberRole !== memberRole) {
      showFeedbackDialog({
        title: '회원 등록 확인 필요',
        message:
          '서버 응답에 역할 정보가 없습니다. 백엔드를 재시작하고 Flyway V6 적용 여부를 확인해 주세요.',
      })
      return
    }
    setMembers((previousMembers) => [createdMember, ...previousMembers])
    setDisplayName('')
    setExternalNickname('')
    setMemo('')
    setMemberRole('MEMBER')
    setIsMemberCreatePage(false)
    showFeedbackDialog({
      title: '회원 등록 완료',
      message: `${createdMember.displayName}님을 ${memberRoleLabels[createdMember.memberRole]}으로 등록했습니다.`,
    })
  }

  function openMemberCreatePage() {
    setSelectedMember(null)
    setIsMemberDetailPage(false)
    setIsMemberParticipationPage(false)
    setDisplayName('')
    setExternalNickname('')
    setJoinedOn(today)
    setMemo('')
    setMemberRole('MEMBER')
    setFieldErrors({})
    setMessage('')
    setIsMemberCreatePage(true)
  }

  async function selectMember(member: Member) {
    setSelectedMember(member)
    setIsMemberSheetOpen(true)
    setIsMemberDetailPage(false)
    setIsMemberParticipationPage(false)
    setDisplayName(member.displayName)
    setExternalNickname(member.externalNickname ?? '')
    setJoinedOn(member.joinedOn)
    setMemo(member.memo ?? '')
    setMemberRole(member.memberRole)
    setMembershipDate(today)
    setExclusions([])
    setEditingExclusion(null)
    setIsLoadingExclusions(true)

    try {
      const response = await fetch(
        `/api/v1/members/${member.id}/activity-exclusions`,
        {
          credentials: 'include',
        },
      )
      if (!response.ok) {
        throw new Error('활동 중단 기간을 불러오지 못했습니다.')
      }
      setExclusions((await response.json()) as ActivityExclusion[])
    } catch {
      setMessage('활동 중단 기간을 불러오지 못했습니다.')
    } finally {
      setIsLoadingExclusions(false)
    }
  }

  async function handleUpdateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) {
      return
    }
    if (selectedMember === null) {
      return
    }

    setMessage('')
    setFieldErrors({})
    const payload = {
      displayName,
      externalNickname: externalNickname || null,
      joinedOn,
      memo: memo || null,
      memberRole,
    }
    const changedFields = [
      selectedMember.displayName !== payload.displayName ? '이름' : null,
      selectedMember.externalNickname !== payload.externalNickname
        ? '소모임 닉네임'
        : null,
      selectedMember.memberRole !== payload.memberRole ? '역할' : null,
      selectedMember.joinedOn !== payload.joinedOn ? '가입일' : null,
      selectedMember.memo !== payload.memo ? '메모' : null,
    ].filter((field): field is string => field !== null)

    const response = await fetch(`/api/v1/members/${selectedMember.id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const errorMessage = await applyApiError(
        response,
        '회원 정보 수정에 실패했습니다.',
      )
      showFeedbackDialog({
        title: '회원 정보 저장 실패',
        message: errorMessage,
      })
      return
    }

    const responseMember = (await response.json()) as Partial<Member>
    if (
      selectedMember.memberRole !== memberRole &&
      responseMember.memberRole !== memberRole
    ) {
      showFeedbackDialog({
        title: '역할 저장 실패',
        message:
          '서버가 변경한 역할을 반환하지 않았습니다. 백엔드를 재시작하고 Flyway V6 적용 여부를 확인해 주세요.',
      })
      return
    }
    const updatedMember = {
      ...responseMember,
      memberRole: responseMember.memberRole ?? selectedMember.memberRole,
    } as Member
    setMembers((previousMembers) =>
      previousMembers.map((member) =>
        member.id === updatedMember.id ? updatedMember : member,
      ),
    )
    setSelectedMember(updatedMember)
    setIsMembershipModalOpen(false)
    showFeedbackDialog({
      title: '회원 정보 저장 완료',
      message:
        changedFields.length === 0
          ? '변경된 정보가 없습니다.'
          : `${changedFields.join(', ')} 정보를 저장했습니다.`,
    })
  }

  async function handleMembershipStatusChange() {
    if (!canManage) {
      return
    }
    if (selectedMember === null) {
      return
    }

    const isWithdrawing = selectedMember.membershipStatus === 'ACTIVE'
    const action = isWithdrawing ? 'withdraw' : 'reactivate'

    const response = await fetch(
      `/api/v1/members/${selectedMember.id}/${action}`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: membershipDate }),
      },
    )
    if (!response.ok) {
      setMessage('회원 상태 변경에 실패했습니다.')
      return
    }

    const updatedMember = (await response.json()) as Member
    setMembers((previousMembers) =>
      previousMembers.map((member) =>
        member.id === updatedMember.id ? updatedMember : member,
      ),
    )
    setSelectedMember(updatedMember)
    setMessage(
      isWithdrawing ? '회원 탈퇴를 처리했습니다.' : '회원을 재활성화했습니다.',
    )
  }

  async function handleStartExclusion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage) {
      return
    }
    if (selectedMember === null) {
      return
    }

    const payload = {
      reason: exclusionReason,
      startDate: exclusionStartDate,
      endDate: isExclusionEndDateSet ? exclusionEndDate : null,
      note: exclusionNote || null,
    }

    if (editingExclusion !== null) {
      await handleUpdateExclusion(payload)
      return
    }

    const response = await fetch(
      `/api/v1/members/${selectedMember.id}/activity-exclusions`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
    if (!response.ok) {
      setMessage(
        '활동 중단 기간 등록에 실패했습니다. 기존 기간과 겹치는지 확인해 주세요.',
      )
      return
    }

    const exclusion = (await response.json()) as ActivityExclusion
    setExclusions((previousExclusions) => [exclusion, ...previousExclusions])
    setSelectedMember((member) =>
      member === null ||
      exclusion.startDate > today ||
      (exclusion.endDate !== null && exclusion.endDate < today)
        ? member
        : { ...member, activityPaused: true },
    )
    setExclusionNote('')
    setIsExclusionEndDateSet(false)
    setMessage('활동 중단 기간을 등록했습니다.')
  }

  async function handleUpdateExclusion(payload: {
    reason: ActivityExclusionReason
    startDate: string
    endDate: string | null
    note: string | null
  }) {
    if (!canManage) {
      return
    }
    if (selectedMember === null || editingExclusion === null) {
      return
    }

    const request = payload
    const response = await fetch(
      `/api/v1/members/${selectedMember.id}/activity-exclusions/${editingExclusion.id}`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    )
    if (!response.ok) {
      setMessage(
        '활동 중단 기간 수정에 실패했습니다. 기존 기간과 겹치는지 확인해 주세요.',
      )
      return
    }

    const updatedExclusion = (await response.json()) as ActivityExclusion
    setExclusions((previousExclusions) =>
      previousExclusions.map((item) =>
        item.id === updatedExclusion.id ? updatedExclusion : item,
      ),
    )
    setEditingExclusion(null)
    setExclusionNote('')
    setMessage('활동 중단 기간을 수정했습니다.')
  }

  function beginExclusionEdit(exclusion: ActivityExclusion) {
    if (!canManage) {
      return
    }
    setEditingExclusion(exclusion)
    setExclusionReason(exclusion.reason)
    setExclusionStartDate(exclusion.startDate)
    setExclusionEndDate(exclusion.endDate ?? today)
    setIsExclusionEndDateSet(exclusion.endDate !== null)
    setExclusionNote(exclusion.note ?? '')
  }

  function cancelExclusionEdit() {
    setEditingExclusion(null)
    setExclusionReason('PERSONAL_BREAK')
    setExclusionStartDate(today)
    setExclusionEndDate(today)
    setIsExclusionEndDateSet(false)
    setExclusionNote('')
  }

  function closeActivityExclusionModal() {
    cancelExclusionEdit()
    setIsActivityExclusionModalOpen(false)
  }

  function openMemberParticipationHistory() {
    setIsMemberSheetOpen(false)
    setIsMemberDetailPage(false)
    setIsMemberParticipationPage(true)
  }

  async function handleEndExclusion(exclusion: ActivityExclusion) {
    if (!canManage) {
      return
    }
    if (selectedMember === null) {
      return
    }

    const confirmed = await confirm({
      title: '활동 상태 변경',
      message: `${selectedMember.displayName}님의 상태를 활동 중으로 변경하시겠습니까?`,
      confirmLabel: '활동 중으로 변경',
    })
    if (!confirmed) {
      return
    }

    const response = await fetch(
      `/api/v1/members/${selectedMember.id}/activity-exclusions/${exclusion.id}/end`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: today }),
      },
    )
    if (!response.ok) {
      setMessage('활동 중단 기간 종료에 실패했습니다.')
      return
    }

    const endedExclusion = (await response.json()) as ActivityExclusion
    setExclusions((previousExclusions) =>
      previousExclusions.map((item) =>
        item.id === endedExclusion.id ? endedExclusion : item,
      ),
    )
    setSelectedMember((member) =>
      member === null ? member : { ...member, activityPaused: false },
    )
    setMembers((previousMembers) =>
      previousMembers.map((member) =>
        member.id === selectedMember.id
          ? { ...member, activityPaused: false }
          : member,
      ),
    )
    setMessage('활동 중단 기간을 종료했습니다.')
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setCurrentLoginId(null)
    setCurrentDisplayName('')
    setIsAdmin(false)
    setMembers([])
    setSelectedMember(null)
    setIsMemberSheetOpen(false)
    setIsMemberDetailPage(false)
    setIsMembershipModalOpen(false)
    setIsActivityExclusionModalOpen(false)
    setEditingExclusion(null)
    setMessage('로그아웃했습니다.')
  }

  function openOwnProfileModal() {
    setOwnDisplayName(currentDisplayName)
    setOwnPassword('')
    setOwnPasswordConfirmation('')
    setIsOwnPasswordModalOpen(true)
  }

  async function handleOwnProfileChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ownDisplayName.trim()) {
      setMessage('표시 이름을 입력해 주세요.')
      return
    }
    if (ownPassword && ownPassword.length < 8) {
      setMessage('새 비밀번호는 8자 이상 입력해 주세요.')
      return
    }
    if (ownPassword !== ownPasswordConfirmation) {
      setMessage('새 비밀번호 확인이 일치하지 않습니다.')
      return
    }
    const response = await fetch('/api/v1/auth/profile', {
      body: JSON.stringify({
        displayName: ownDisplayName.trim(),
        password: ownPassword || null,
      }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    })
    if (!response.ok) {
      setMessage('내 정보를 변경하지 못했습니다.')
      return
    }
    setCurrentDisplayName(ownDisplayName.trim())
    setOwnPassword('')
    setOwnPasswordConfirmation('')
    setIsOwnPasswordModalOpen(false)
    setMessage('내 정보를 변경했습니다.')
  }

  if (currentLoginId === null) {
    const backendStatusLabel = {
      CHECKING: '서버 연결 확인 중',
      READY: '서버 준비됨',
      UNAVAILABLE: '서버를 시작 중입니다. 잠시 후 자동으로 다시 확인합니다.',
    }[backendStatus]

    return (
      <main className="login-page">
        <Card className="login-card" aria-labelledby="login-heading">
          <p className="eyebrow">MOING MOING</p>
          <h1 id="login-heading">운영진 관리</h1>
          <p className="description">회원과 모임 운영 기록을 관리합니다.</p>
          <p
            aria-live="polite"
            className={`backend-status backend-status-${backendStatus.toLowerCase()}`}
            role="status"
          >
            <span aria-hidden="true" className="backend-status-indicator" />
            {backendStatusLabel}
          </p>
          <form className="form" onSubmit={handleLogin}>
            <label>
              로그인 ID
              <input
                autoComplete="username"
                onChange={(event) => setLoginId(event.target.value)}
                required
                value={loginId}
              />
            </label>
            <label>
              비밀번호
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button
              disabled={backendStatus !== 'READY' || isAuthenticating}
              type="submit"
            >
              {isAuthenticating ? '로그인 중…' : '로그인'}
            </button>
          </form>
        </Card>
      </main>
    )
  }

  return (
    <main className="app-shell">
      {isRequestInProgress && (
        <div aria-live="polite" className="api-loading-overlay" role="status">
          <span aria-hidden="true" className="api-loading-spinner" />
          처리 중입니다…
        </div>
      )}
      <header className="app-header">
        <div>
          <p className="eyebrow">MOING MOING</p>
          <h1>{currentPage === 'MEMBERS' ? '회원 관리' : '출석 관리'}</h1>
        </div>
        <div className="account-actions">
          <span>{currentDisplayName}</span>
          <Button
            aria-label="내 비밀번호 변경"
            onClick={openOwnProfileModal}
            type="button"
            variant="secondary"
          >
            <SettingsIcon />
          </Button>
          <Button onClick={handleLogout} type="button" variant="secondary">
            로그아웃
          </Button>
        </div>
      </header>

      <nav
        aria-label="주요 메뉴"
        className="primary-navigation"
        style={
          {
            '--active-index': navigationItems.findIndex(
              (item) => item.value === currentPage,
            ),
            '--item-count': navigationItems.length,
          } as CSSProperties
        }
      >
        <span aria-hidden="true" className="primary-navigation-indicator" />
        {navigationItems.map((item) => (
          <button
            className={
              currentPage === item.value
                ? 'navigation-active'
                : 'secondary-button'
            }
            key={item.value}
            onClick={() => navigateToPage(item.value)}
            type="button"
          >
            {item.desktopLabel}
          </button>
        ))}
      </nav>

      {currentPage === 'MEMBERS' && (
        <section
          className={
            isMemberDetailPage ||
            isMemberParticipationPage ||
            isMemberCreatePage
              ? 'member-page'
              : 'member-list-page'
          }
        >
          {!isMemberDetailPage && !isMemberParticipationPage && (
            <>
              {canManage && isMemberCreatePage && (
                <section
                  className="panel member-create-page"
                  aria-labelledby="member-create-heading"
                >
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">NEW MEMBER</p>
                      <h2 id="member-create-heading">새 회원 등록</h2>
                    </div>
                    <button
                      className="secondary-button"
                      onClick={() => setIsMemberCreatePage(false)}
                      type="button"
                    >
                      목록으로
                    </button>
                  </div>
                  <MemberProfileForm
                    displayName={displayName}
                    externalNickname={externalNickname}
                    fieldErrors={fieldErrors}
                    joinedOn={joinedOn}
                    memo={memo}
                    memberRole={memberRole as MemberProfileRole}
                    onDisplayNameChange={setDisplayName}
                    onExternalNicknameChange={setExternalNickname}
                    onJoinedOnChange={setJoinedOn}
                    onMemberRoleChange={(role) => setMemberRole(role)}
                    onMemoChange={setMemo}
                    onSubmit={handleCreateMember}
                    submitLabel="회원 등록"
                  />
                </section>
              )}

              {!isMemberCreatePage && (
                <section
                  className="panel member-list-panel"
                  aria-labelledby="member-list-heading"
                >
                  <div className="panel-heading">
                    <div>
                      <h2 id="member-list-heading">현재 회원</h2>
                      <p>
                        {visibleMembers.length}명 / 전체 {members.length}명
                      </p>
                    </div>
                    <div className="header-actions">
                      {canManage && (
                        <button onClick={openMemberCreatePage} type="button">
                          회원 추가
                        </button>
                      )}
                      <button
                        aria-label="새로고침"
                        className="secondary-button icon-button"
                        onClick={() => void loadMembers()}
                        type="button"
                      >
                        <RefreshIcon />
                      </button>
                    </div>
                  </div>
                  <div className="member-list-controls">
                    <label>
                      회원 검색
                      <input
                        onChange={(event) =>
                          setMemberSearch(event.target.value)
                        }
                        placeholder="이름 또는 닉네임"
                        value={memberSearch}
                      />
                    </label>
                    <div
                      className="member-filter-buttons"
                      role="group"
                      aria-label="활동 상태 필터"
                    >
                      <button
                        className={
                          activityFilter === 'ALL'
                            ? 'member-filter-all is-active'
                            : 'member-filter-all secondary-button'
                        }
                        onClick={() => setActivityFilter('ALL')}
                        type="button"
                      >
                        전체
                      </button>
                      <button
                        className={
                          activityFilter === 'ACTIVE'
                            ? 'member-filter-active is-active is-active-green'
                            : 'member-filter-active secondary-button'
                        }
                        onClick={() => setActivityFilter('ACTIVE')}
                        type="button"
                      >
                        활동 중
                      </button>
                      <button
                        className={
                          activityFilter === 'PAUSED'
                            ? 'member-filter-paused is-active is-active-gray'
                            : 'member-filter-paused secondary-button'
                        }
                        onClick={() => setActivityFilter('PAUSED')}
                        type="button"
                      >
                        활동 중단
                      </button>
                    </div>
                    <div
                      className="member-sort-buttons"
                      role="group"
                      aria-label="회원 정렬"
                    >
                      <button
                        className={`secondary-button member-sort-${nameSortDirection?.toLowerCase() ?? 'none'}`}
                        onClick={() => {
                          setNameSortDirection(
                            nextSortDirection(nameSortDirection),
                          )
                          setJoinedOnSortDirection(null)
                        }}
                        type="button"
                      >
                        이름{' '}
                        {nameSortDirection === 'ASC'
                          ? '↑'
                          : nameSortDirection === 'DESC'
                            ? '↓'
                            : '↕'}
                      </button>
                      <button
                        className={`secondary-button member-sort-${joinedOnSortDirection?.toLowerCase() ?? 'none'}`}
                        onClick={() => {
                          setJoinedOnSortDirection(
                            nextSortDirection(joinedOnSortDirection),
                          )
                          setNameSortDirection(null)
                        }}
                        type="button"
                      >
                        가입일{' '}
                        {joinedOnSortDirection === 'ASC'
                          ? '↑'
                          : joinedOnSortDirection === 'DESC'
                            ? '↓'
                            : '↕'}
                      </button>
                    </div>
                  </div>
                  {visibleMembers.length === 0 ? (
                    <EmptyState
                      description="검색어나 필터를 조정해 다시 확인해 보세요."
                      icon="⌕"
                      title="조건에 맞는 회원이 없습니다"
                    />
                  ) : (
                    <ul className="member-list">
                      {visibleMembers.map((member) => {
                        const inactivityBadge = getInactivityBadge(member)

                        return (
                          <li key={member.id}>
                            <button
                              className="member-row"
                              onClick={() => void selectMember(member)}
                              type="button"
                            >
                              <div className="member-identity">
                                <div className="member-name-line">
                                  <MemberRoleIcon role={member.memberRole} />
                                  <strong>{member.displayName}</strong>
                                  <span
                                    className={`member-activity-status ${member.activityPaused ? 'is-paused' : 'is-active'}`}
                                  >
                                    {member.activityPaused
                                      ? '활동 중단'
                                      : '활동 중'}
                                  </span>
                                </div>
                                <div className="member-meta-line">
                                  <span>
                                    {member.externalNickname ??
                                      '소모임 닉네임 없음'}
                                  </span>
                                </div>
                              </div>
                              <div className="member-inactivity-column">
                                {inactivityBadge && (
                                  <span
                                    className={`inactivity-badge inactivity-badge-${inactivityBadge.tone}`}
                                  >
                                    {inactivityBadge.label}
                                  </span>
                                )}
                              </div>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}

          {selectedMember && !isMemberSheetOpen && isMemberDetailPage && (
            <section
              className="panel member-detail"
              aria-labelledby="member-detail-heading"
            >
              <div className="panel-heading">
                <div>
                  <h2 id="member-detail-heading">회원 상세</h2>
                  <p className="member-detail-role">
                    <span
                      aria-label={`직책 ${memberRoleLabels[selectedMember.memberRole]}`}
                      className={`member-role-badge member-role-${selectedMember.memberRole.toLowerCase()}`}
                    >
                      <MemberRoleIcon
                        decorative
                        role={selectedMember.memberRole}
                      />
                      {memberRoleLabels[selectedMember.memberRole]}
                    </span>
                    {` ${selectedMember.displayName}`}
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => setIsMemberDetailPage(false)}
                  type="button"
                >
                  목록으로
                </button>
              </div>

              <MemberProfileForm
                displayName={displayName}
                externalNickname={externalNickname}
                fieldErrors={fieldErrors}
                joinedOn={joinedOn}
                memo={memo}
                memberRole={memberRole as MemberProfileRole}
                onDisplayNameChange={setDisplayName}
                onExternalNicknameChange={setExternalNickname}
                onJoinedOnChange={setJoinedOn}
                onMemberRoleChange={(role) => setMemberRole(role)}
                onMemoChange={setMemo}
                onSubmit={handleUpdateMember}
                readOnly={!canManage}
                submitLabel="저장"
                actions={
                  canManage && (
                    <>
                      <button
                        className="secondary-button"
                        onClick={() => setIsActivityExclusionModalOpen(true)}
                        type="button"
                      >
                        {isSelectedMemberActivityPaused
                          ? '활동 중단 관리'
                          : '활동 중단'}
                      </button>
                      <button
                        className={
                          selectedMember.membershipStatus === 'ACTIVE'
                            ? 'danger-button'
                            : 'secondary-button'
                        }
                        onClick={() => setIsMembershipModalOpen(true)}
                        type="button"
                      >
                        {selectedMember.membershipStatus === 'ACTIVE'
                          ? '탈퇴 처리'
                          : '재활성화'}
                      </button>
                    </>
                  )
                }
              />
            </section>
          )}

          {selectedMember &&
            !isMemberSheetOpen &&
            isMemberParticipationPage && (
              <section
                aria-labelledby="member-participation-page-heading"
                className="panel member-detail"
              >
                <div className="panel-heading">
                  <div>
                    <h2 id="member-participation-page-heading">참여 이력</h2>
                    <p>
                      {selectedMember.displayName}님의 수업과 행사 참여
                      기록입니다.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => {
                      setIsMemberParticipationPage(false)
                      setSelectedMember(null)
                    }}
                    type="button"
                  >
                    목록으로
                  </button>
                </div>
                <MemberParticipationHistory
                  memberId={selectedMember.id}
                  standalone
                />
              </section>
            )}

          {isMembershipModalOpen && selectedMember && (
            <Modal
              ariaLabelledBy="membership-status-heading"
              className="modal-content member-action-modal"
              closeLabel="회원 상태 변경 닫기"
              footer={
                <>
                  <button
                    className="secondary-button"
                    onClick={() => setIsMembershipModalOpen(false)}
                    type="button"
                  >
                    취소
                  </button>
                  <button
                    className={
                      selectedMember.membershipStatus === 'ACTIVE'
                        ? 'danger-button'
                        : undefined
                    }
                    onClick={() => void handleMembershipStatusChange()}
                    type="button"
                  >
                    {selectedMember.membershipStatus === 'ACTIVE'
                      ? '탈퇴 처리'
                      : '재활성화'}
                  </button>
                </>
              }
              onClose={() => setIsMembershipModalOpen(false)}
            >
              <div className="modal-heading">
                <h3 id="membership-status-heading">회원 상태 변경</h3>
                <p>
                  현재 상태:{' '}
                  <strong>
                    {selectedMember.membershipStatus === 'ACTIVE'
                      ? '활동 중'
                      : '탈퇴'}
                  </strong>
                </p>
              </div>
              <div className="form">
                <label>
                  {selectedMember.membershipStatus === 'ACTIVE'
                    ? '탈퇴일'
                    : '재활성화일'}
                  <KoreanDateInput
                    onChange={setMembershipDate}
                    value={membershipDate}
                  />
                </label>
              </div>
            </Modal>
          )}

          {isActivityExclusionModalOpen && selectedMember && (
            <Modal
              ariaLabelledBy="activity-exclusion-heading"
              className="modal-content member-action-modal"
              closeLabel="활동 중단 관리 닫기"
              footer={
                !isLoadingExclusions &&
                !(
                  isSelectedMemberActivityPaused && editingExclusion === null
                ) ? (
                  <>
                    {editingExclusion && (
                      <button
                        className="secondary-button"
                        disabled={!canManage}
                        onClick={cancelExclusionEdit}
                        type="button"
                      >
                        수정 취소
                      </button>
                    )}
                    <button
                      disabled={!canManage}
                      form="activity-exclusion-form"
                      type="submit"
                    >
                      {editingExclusion === null
                        ? '활동 중단 시작'
                        : '활동 중단 기간 저장'}
                    </button>
                  </>
                ) : undefined
              }
              onClose={closeActivityExclusionModal}
            >
              <div className="modal-heading">
                <h3 id="activity-exclusion-heading">활동 중단 관리</h3>
                <p>시작·수정·종료와 기간 이력을 관리합니다.</p>
              </div>
              {isLoadingExclusions ? (
                <p className="description">
                  활동 중단 기간을 확인하고 있습니다.
                </p>
              ) : isSelectedMemberActivityPaused &&
                editingExclusion === null ? (
                <p className="description">
                  현재 활동 중단 기간입니다. 아래 목록에서 종료 처리하거나
                  기간을 수정해 주세요.
                </p>
              ) : (
                <form
                  className="form"
                  id="activity-exclusion-form"
                  onSubmit={handleStartExclusion}
                >
                  <SelectField
                    label="사유"
                    onChange={(value) =>
                      setExclusionReason(value as ActivityExclusionReason)
                    }
                    options={Object.entries(activityExclusionReasonLabels).map(
                      ([value, label]) => ({ value, label }),
                    )}
                    value={exclusionReason}
                  />
                  <label>
                    시작일
                    <KoreanDateInput
                      onChange={setExclusionStartDate}
                      required
                      value={exclusionStartDate}
                    />
                  </label>
                  <fieldset className="exclusion-end-date-field">
                    <legend>
                      종료일 <span className="optional">(선택)</span>
                    </legend>
                    <label className="exclusion-end-date-toggle">
                      <input
                        checked={isExclusionEndDateSet}
                        onChange={(event) =>
                          setIsExclusionEndDateSet(event.target.checked)
                        }
                        type="checkbox"
                      />
                      종료일 설정
                    </label>
                    <KoreanDateInput
                      disabled={!isExclusionEndDateSet}
                      onChange={setExclusionEndDate}
                      value={exclusionEndDate}
                    />
                  </fieldset>
                  <label>
                    메모 <span className="optional">(선택)</span>
                    <textarea
                      onChange={(event) => setExclusionNote(event.target.value)}
                      value={exclusionNote}
                    />
                  </label>
                </form>
              )}
              {exclusions.length === 0 ? (
                <p className="empty-state">등록된 활동 중단 기간이 없습니다.</p>
              ) : (
                <ul className="exclusion-list">
                  {exclusions.map((exclusion) => (
                    <li key={exclusion.id}>
                      <div>
                        <strong>
                          {activityExclusionReasonLabels[exclusion.reason]}
                        </strong>
                        <span>
                          {exclusion.startDate} ~{' '}
                          {exclusion.endDate ?? '무기한'}
                        </span>
                        {exclusion.note && <span>{exclusion.note}</span>}
                      </div>
                      <div className="exclusion-actions">
                        <button
                          className="edit-button"
                          disabled={!canManage}
                          onClick={() => beginExclusionEdit(exclusion)}
                          type="button"
                        >
                          수정
                        </button>
                        {isActivityExclusionActive(exclusion) && (
                          <button
                            className="secondary-button"
                            disabled={!canManage}
                            onClick={() => void handleEndExclusion(exclusion)}
                            type="button"
                          >
                            종료
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Modal>
          )}

          {isMemberSheetOpen && selectedMember && (
            <div
              className="bottom-sheet-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setIsMemberSheetOpen(false)
                }
              }}
            >
              <section
                aria-labelledby="member-sheet-heading"
                aria-modal="true"
                className="bottom-sheet"
                role="dialog"
              >
                <div className="bottom-sheet-handle" />
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">MEMBER</p>
                    <h2 id="member-sheet-heading">
                      {selectedMember.displayName}
                    </h2>
                    <p>
                      <span
                        aria-label={`직책 ${memberRoleLabels[selectedMember.memberRole]}`}
                        className={`member-role-badge member-role-${selectedMember.memberRole.toLowerCase()}`}
                      >
                        <MemberRoleIcon
                          decorative
                          role={selectedMember.memberRole}
                        />
                        {memberRoleLabels[selectedMember.memberRole]}
                      </span>{' '}
                      {selectedMember.membershipStatus === 'ACTIVE'
                        ? '활동 중'
                        : '탈퇴'}
                      {selectedMember.externalNickname &&
                        ` · ${selectedMember.externalNickname}`}
                    </p>
                  </div>
                  <button
                    aria-label="회원 참여 이력 보기"
                    className="secondary-button"
                    onClick={openMemberParticipationHistory}
                    type="button"
                  >
                    참여 이력
                  </button>
                </div>
                <dl className="member-sheet-summary">
                  <div>
                    <dt>가입일</dt>
                    <dd>{formatKoreanDate(selectedMember.joinedOn)}</dd>
                  </div>
                  <div>
                    <dt>메모</dt>
                    <dd>{selectedMember.memo ?? '등록된 메모 없음'}</dd>
                  </div>
                </dl>
                <div className="bottom-sheet-actions">
                  <button
                    onClick={() => {
                      setIsMemberSheetOpen(false)
                      setIsMemberParticipationPage(false)
                      setIsMemberDetailPage(true)
                    }}
                    type="button"
                  >
                    상세 보기
                  </button>
                </div>
              </section>
            </div>
          )}
        </section>
      )}
      {currentPage === 'ATTENDANCE' && (
        <AttendancePage members={members} readOnly={!canManage} />
      )}
      {currentPage === 'COUPONS' && (
        <CouponPage members={members} readOnly={!canManage} />
      )}
      {currentPage === 'STATISTICS' && <MonthlyStatisticsPage />}
      {currentPage === 'MEETING_NOTES' && (
        <MeetingNotePage isAdmin={isAdmin} readOnly={!canManage} />
      )}
      {currentPage === 'OPERATIONS' && isAdmin && <OperationsPage />}
      {isOwnPasswordModalOpen && (
        <Modal
          ariaLabelledBy="own-profile-heading"
          className="modal-content member-action-modal"
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsOwnPasswordModalOpen(false)}
                type="button"
              >
                취소
              </button>
              <button form="own-profile-form" type="submit">
                저장
              </button>
            </>
          }
          onClose={() => setIsOwnPasswordModalOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="own-profile-heading">내 정보 수정</h3>
            <p>
              표시 이름은 변경할 수 있고, 비밀번호는 필요할 때만 입력해 주세요.
            </p>
          </div>
          <form
            className="form"
            id="own-profile-form"
            onSubmit={handleOwnProfileChange}
          >
            <label>
              표시 이름
              <input
                onChange={(event) => setOwnDisplayName(event.target.value)}
                required
                value={ownDisplayName}
              />
            </label>
            <label>
              새 비밀번호
              <input
                minLength={8}
                onChange={(event) => setOwnPassword(event.target.value)}
                type="password"
                value={ownPassword}
              />
            </label>
            <label>
              새 비밀번호 확인
              <input
                minLength={8}
                onChange={(event) =>
                  setOwnPasswordConfirmation(event.target.value)
                }
                type="password"
                value={ownPasswordConfirmation}
              />
            </label>
          </form>
        </Modal>
      )}
      {currentPage === 'MEMBERS' &&
        !isMemberDetailPage &&
        !isMemberParticipationPage &&
        !isMemberCreatePage && (
          <button
            aria-label="회원 목록 맨 위로 이동"
            className="scroll-to-top-button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            type="button"
          >
            <ScrollTopIcon />
          </button>
        )}
      <BottomNav
        active={currentPage}
        items={navigationItems}
        onChange={navigateToPage}
      />
      {message && (
        <FeedbackMessageDialog
          message={message}
          onClose={() => setMessage('')}
        />
      )}
    </main>
  )
}

export default App
