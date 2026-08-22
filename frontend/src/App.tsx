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
import { MeetingNotePage } from './features/meetingnote/MeetingNotePage'
import { MonthlyStatisticsPage } from './features/statistics/MonthlyStatisticsPage'
import {
  apiFetch as fetch,
  apiLoadingChangeEvent,
  apiUnauthorizedEvent,
  isApiLoading,
} from './shared/api/apiFetch'
import { useFeedbackDialog } from './shared/feedback-dialog/useFeedbackDialog'
import { BottomNav } from './shared/ui/BottomNav'
import { EmptyState } from './shared/ui/EmptyState'
import { KoreanDateInput, formatKoreanDate } from './shared/ui/KoreanDateInput'
import { Button, Card, Chip } from './shared/ui/ui'
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
  loginId: string
  readOnly: boolean
}

type MemberStatusFilter = 'ALL' | Member['membershipStatus']
type MemberRoleFilter = 'ALL' | Member['memberRole']
type MemberSort = 'ROLE_PRIORITY' | 'NAME_ASC' | 'JOINED_ON_DESC'
type MemberRole = Member['memberRole']
type PageKey =
  'MEMBERS' | 'ATTENDANCE' | 'COUPONS' | 'STATISTICS' | 'MEETING_NOTES'

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => void
}

const today = new Date().toISOString().slice(0, 10)

const activityExclusionReasonLabels: Record<ActivityExclusionReason, string> = {
  PERSONAL_BREAK: '개인 사정',
  MEDICAL: '건강/치료',
  MILITARY_SERVICE: '군 복무',
  OTHER: '기타',
}

const memberRoleLabels: Record<MemberRole, string> = {
  MEMBER: '회원',
  STAFF: '운영진',
  LEADER: '모임장',
}

const memberRoleIcons: Record<MemberRole, string> = {
  MEMBER: '●',
  STAFF: '◆',
  LEADER: '♛',
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
  const [isReadOnly, setIsReadOnly] = useState(false)
  const isRequestInProgress = useSyncExternalStore(
    subscribeToApiLoading,
    isApiLoading,
    () => false,
  )
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isMemberSheetOpen, setIsMemberSheetOpen] = useState(false)
  const [isMemberDetailPage, setIsMemberDetailPage] = useState(false)
  const [isMemberCreatePage, setIsMemberCreatePage] = useState(false)
  const [exclusions, setExclusions] = useState<ActivityExclusion[]>([])
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
  const [message, setMessage] = useState('')
  const { showFeedbackDialog } = useFeedbackDialog()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] =
    useState<MemberStatusFilter>('ALL')
  const [memberRoleFilter, setMemberRoleFilter] =
    useState<MemberRoleFilter>('ALL')
  const [memberSort, setMemberSort] = useState<MemberSort>('ROLE_PRIORITY')
  const [currentPage, setCurrentPage] = useState<PageKey>('MEMBERS')

  useEffect(() => {
    const handleUnauthorized = () => {
      setCurrentLoginId(null)
      setIsReadOnly(false)
      setMembers([])
      setSelectedMember(null)
      setMessage('서버 세션이 만료되어 자동으로 로그아웃되었습니다.')
    }
    window.addEventListener(apiUnauthorizedEvent, handleUnauthorized)
    return () => window.removeEventListener(apiUnauthorizedEvent, handleUnauthorized)
  }, [])

  const navigationItems = [
    { value: 'MEMBERS', label: '회원', icon: '♙' },
    { value: 'ATTENDANCE', label: '출석', icon: '✓' },
    { value: 'COUPONS', label: '쿠폰', icon: '◇' },
    { value: 'STATISTICS', label: '통계', icon: '▥' },
    { value: 'MEETING_NOTES', label: '회의록', icon: '☰' },
  ] satisfies { value: PageKey; label: string; icon: string }[]

  function navigateToPage(nextPage: PageKey) {
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

  const visibleMembers = useMemo(() => {
    const normalizedSearch = memberSearch.trim().toLocaleLowerCase()
    return [...members]
      .filter(
        (member) =>
          memberStatusFilter === 'ALL' ||
          member.membershipStatus === memberStatusFilter,
      )
      .filter(
        (member) =>
          memberRoleFilter === 'ALL' || member.memberRole === memberRoleFilter,
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
        if (memberSort === 'ROLE_PRIORITY') {
          const roleDifference =
            memberRolePriority[left.memberRole] -
            memberRolePriority[right.memberRole]
          if (roleDifference !== 0) {
            return roleDifference
          }
        }
        if (memberSort === 'JOINED_ON_DESC') {
          return right.joinedOn.localeCompare(left.joinedOn)
        }
        return left.displayName.localeCompare(right.displayName, 'ko')
      })
  }, [memberRoleFilter, memberSearch, memberSort, memberStatusFilter, members])

  const loadMembers = useCallback(async () => {
    const response = await fetch('/api/v1/members', { credentials: 'include' })
    if (!response.ok) {
      throw new Error('회원 목록을 불러오지 못했습니다.')
    }
    setMembers((await response.json()) as Member[])
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
      setIsReadOnly(account.readOnly)
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
    setMessage(errorMessage)
    return errorMessage
  }

  useEffect(() => {
    // Session restoration is an asynchronous server-state synchronization on initial render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restoreSession()
  }, [restoreSession])

  useEffect(() => {
    if (!isMemberSheetOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMemberSheetOpen(false)
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMemberSheetOpen])

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')

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

    setCurrentLoginId(loginId)
    setIsReadOnly(false)
    setPassword('')
    await loadMembers()
  }

  async function handleGuestLogin() {
    setMessage('')
    const response = await fetch('/api/v1/auth/guest-login', {
      method: 'POST',
      credentials: 'include',
    })

    if (!response.ok) {
      setMessage(
        '게스트 모드를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
      return
    }

    setCurrentLoginId('guest')
    setIsReadOnly(true)
    await loadMembers()
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isReadOnly) {
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
    setMessage('회원을 등록했습니다.')
    showFeedbackDialog({
      title: '회원 등록 완료',
      message: `${createdMember.displayName}님을 ${memberRoleLabels[createdMember.memberRole]}으로 등록했습니다.`,
    })
  }

  function openMemberCreatePage() {
    setSelectedMember(null)
    setIsMemberDetailPage(false)
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
    setDisplayName(member.displayName)
    setExternalNickname(member.externalNickname ?? '')
    setJoinedOn(member.joinedOn)
    setMemo(member.memo ?? '')
    setMemberRole(member.memberRole)
    setMembershipDate(today)
    setExclusions([])
    setEditingExclusion(null)

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
    }
  }

  async function handleUpdateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isReadOnly) {
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
    setMessage('회원 정보를 수정했습니다.')
    showFeedbackDialog({
      title: '회원 정보 저장 완료',
      message:
        changedFields.length === 0
          ? '변경된 정보가 없습니다.'
          : `${changedFields.join(', ')} 정보를 저장했습니다.`,
    })
  }

  async function handleMembershipStatusChange() {
    if (isReadOnly) {
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
    if (isReadOnly) {
      return
    }
    if (selectedMember === null) {
      return
    }

    const payload = {
      reason: exclusionReason,
      startDate: exclusionStartDate,
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
    setExclusionNote('')
    setMessage('활동 중단 기간을 등록했습니다.')
  }

  async function handleUpdateExclusion(payload: {
    reason: ActivityExclusionReason
    startDate: string
    note: string | null
  }) {
    if (isReadOnly) {
      return
    }
    if (selectedMember === null || editingExclusion === null) {
      return
    }

    const request = { ...payload, endDate: editingExclusion.endDate }
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
    if (isReadOnly) {
      return
    }
    setEditingExclusion(exclusion)
    setExclusionReason(exclusion.reason)
    setExclusionStartDate(exclusion.startDate)
    setExclusionNote(exclusion.note ?? '')
  }

  function cancelExclusionEdit() {
    setEditingExclusion(null)
    setExclusionReason('PERSONAL_BREAK')
    setExclusionStartDate(today)
    setExclusionNote('')
  }

  async function handleEndExclusion(exclusion: ActivityExclusion) {
    if (isReadOnly) {
      return
    }
    if (selectedMember === null) {
      return
    }

    const response = await fetch(
      `/api/v1/members/${selectedMember.id}/activity-exclusions/${exclusion.id}/end`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: exclusionEndDate }),
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
    setMessage('활동 중단 기간을 종료했습니다.')
  }

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
    setCurrentLoginId(null)
    setIsReadOnly(false)
    setMembers([])
    setSelectedMember(null)
    setIsMemberSheetOpen(false)
    setIsMemberDetailPage(false)
    setEditingExclusion(null)
    setMessage('로그아웃했습니다.')
  }

  if (currentLoginId === null) {
    return (
      <main className="login-page">
        {isRequestInProgress && (
          <div aria-live="polite" className="api-loading-overlay" role="status">
            <span aria-hidden="true" className="api-loading-spinner" />
            처리 중입니다…
          </div>
        )}
        <Card className="login-card" aria-labelledby="login-heading">
          <p className="eyebrow">MOING MOING</p>
          <h1 id="login-heading">운영진 관리</h1>
          <p className="description">회원과 모임 운영 기록을 관리합니다.</p>
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
            <button type="submit">로그인</button>
          </form>
          <p className="guest-login-prompt">
            둘러보기만 원하시나요?{' '}
            <button
              className="guest-login-button"
              onClick={() => void handleGuestLogin()}
              type="button"
            >
              게스트로 둘러보기
            </button>
          </p>
          {message && selectedMember === null && (
            <p className="message" role="status">
              {message}
            </p>
          )}
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
          <span>{isReadOnly ? '게스트' : currentLoginId}</span>
          {isReadOnly && (
            <Chip className="read-only-badge" tone="primary">
              읽기 전용
            </Chip>
          )}
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
          } as CSSProperties
        }
      >
        <span aria-hidden="true" className="primary-navigation-indicator" />
        <button
          className={
            currentPage === 'MEMBERS' ? 'navigation-active' : 'secondary-button'
          }
          onClick={() => navigateToPage('MEMBERS')}
          type="button"
        >
          회원 관리
        </button>
        <button
          className={
            currentPage === 'ATTENDANCE'
              ? 'navigation-active'
              : 'secondary-button'
          }
          onClick={() => navigateToPage('ATTENDANCE')}
          type="button"
        >
          출석 관리
        </button>
        <button
          className={
            currentPage === 'COUPONS' ? 'navigation-active' : 'secondary-button'
          }
          onClick={() => navigateToPage('COUPONS')}
          type="button"
        >
          쿠폰 관리
        </button>
        <button
          className={
            currentPage === 'STATISTICS'
              ? 'navigation-active'
              : 'secondary-button'
          }
          onClick={() => navigateToPage('STATISTICS')}
          type="button"
        >
          월별 통계
        </button>
        <button
          className={
            currentPage === 'MEETING_NOTES'
              ? 'navigation-active'
              : 'secondary-button'
          }
          onClick={() => navigateToPage('MEETING_NOTES')}
          type="button"
        >
          회의록
        </button>
      </nav>

      {isReadOnly && (
        <p className="read-only-notice" role="status">
          게스트 모드에서는 데이터를 조회만 할 수 있습니다. 등록, 수정, 출석 및
          쿠폰 처리는 관리자 로그인이 필요합니다.
        </p>
      )}

      {currentPage === 'MEMBERS' && (
        <section
          className={
            isMemberDetailPage || isMemberCreatePage
              ? 'member-page'
              : 'member-list-page'
          }
        >
          {!isMemberDetailPage && (
            <>
              {!isReadOnly && isMemberCreatePage && (
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
                  <form className="form" onSubmit={handleCreateMember}>
                    <label>
                      이름
                      <input
                        onChange={(event) => setDisplayName(event.target.value)}
                        required
                        value={displayName}
                      />
                      {fieldErrors.displayName && selectedMember === null && (
                        <span className="field-error">
                          {fieldErrors.displayName}
                        </span>
                      )}
                    </label>
                    <label>
                      소모임 닉네임 <span className="optional">(선택)</span>
                      <input
                        onChange={(event) =>
                          setExternalNickname(event.target.value)
                        }
                        value={externalNickname}
                      />
                    </label>
                    <fieldset className="member-role-selector">
                      <legend>역할</legend>
                      <div className="member-role-options">
                        {Object.entries(memberRoleLabels).map(
                          ([role, label]) => {
                            const memberRoleOption = role as MemberRole
                            const isSelected = memberRole === memberRoleOption

                            return (
                              <label
                                className={`member-role-option member-role-option-${memberRoleOption.toLowerCase()}${
                                  isSelected
                                    ? ' member-role-option-selected'
                                    : ''
                                }`}
                                key={role}
                              >
                                <input
                                  checked={isSelected}
                                  name="member-role"
                                  onChange={() =>
                                    setMemberRole(memberRoleOption)
                                  }
                                  type="radio"
                                  value={memberRoleOption}
                                />
                                <span
                                  className={`member-role-badge member-role-${memberRoleOption.toLowerCase()}`}
                                >
                                  <span aria-hidden="true">
                                    {memberRoleIcons[memberRoleOption]}
                                  </span>
                                  {label}
                                </span>
                                <span className="member-role-description">
                                  {memberRoleOption === 'LEADER'
                                    ? '소모임 대표'
                                    : memberRoleOption === 'STAFF'
                                      ? '운영 보조'
                                      : '일반 참여자'}
                                </span>
                              </label>
                            )
                          },
                        )}
                      </div>
                    </fieldset>
                    <label>
                      가입일
                      <KoreanDateInput
                        onChange={setJoinedOn}
                        required
                        value={joinedOn}
                      />
                      {fieldErrors.joinedOn && selectedMember === null && (
                        <span className="field-error">
                          {fieldErrors.joinedOn}
                        </span>
                      )}
                    </label>
                    <label>
                      메모 <span className="optional">(선택)</span>
                      <textarea
                        onChange={(event) => setMemo(event.target.value)}
                        value={memo}
                      />
                    </label>
                    <button type="submit">회원 등록</button>
                  </form>
                  {message && selectedMember === null && (
                    <p className="message" role="status">
                      {message}
                    </p>
                  )}
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
                      {!isReadOnly && (
                        <button onClick={openMemberCreatePage} type="button">
                          회원 추가
                        </button>
                      )}
                      <button
                        className="secondary-button"
                        onClick={() => void loadMembers()}
                        type="button"
                      >
                        새로고침
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
                    <SelectField
                      label="회원 상태"
                      onChange={(value) =>
                        setMemberStatusFilter(value as MemberStatusFilter)
                      }
                      options={[
                        { value: 'ALL', label: '전체' },
                        { value: 'ACTIVE', label: '활동 중' },
                        { value: 'WITHDRAWN', label: '탈퇴' },
                      ]}
                      value={memberStatusFilter}
                    />
                    <SelectField
                      label="회원 역할"
                      onChange={(value) =>
                        setMemberRoleFilter(value as MemberRoleFilter)
                      }
                      options={[
                        { value: 'ALL', label: '전체' },
                        ...Object.entries(memberRoleLabels).map(([value, label]) => ({
                          value,
                          label,
                        })),
                      ]}
                      value={memberRoleFilter}
                    />
                    <SelectField
                      label="정렬"
                      onChange={(value) => setMemberSort(value as MemberSort)}
                      options={[
                        { value: 'ROLE_PRIORITY', label: '역할 우선' },
                        { value: 'NAME_ASC', label: '이름순' },
                        { value: 'JOINED_ON_DESC', label: '가입일 최신순' },
                      ]}
                      value={memberSort}
                    />
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
                              <div>
                                <div className="member-name-line">
                                  <strong>{member.displayName}</strong>
                                  <span
                                    aria-label={`직책 ${memberRoleLabels[member.memberRole]}`}
                                    className={`member-role-badge member-role-${member.memberRole.toLowerCase()}`}
                                  >
                                    <span aria-hidden="true">
                                      {memberRoleIcons[member.memberRole]}
                                    </span>
                                    {memberRoleLabels[member.memberRole]}
                                  </span>
                                </div>
                                <span>
                                  {member.externalNickname ??
                                    '소모임 닉네임 없음'}
                                </span>
                              </div>
                              <div className="member-row-badges">
                                {inactivityBadge && (
                                  <span
                                    className={`inactivity-badge inactivity-badge-${inactivityBadge.tone}`}
                                  >
                                    {inactivityBadge.label}
                                  </span>
                                )}
                                <span
                                  className={`status status-${member.membershipStatus.toLowerCase()}`}
                                >
                                  {member.membershipStatus === 'ACTIVE'
                                    ? '활동 중'
                                    : '탈퇴'}
                                </span>
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
                      <span aria-hidden="true">
                        {memberRoleIcons[selectedMember.memberRole]}
                      </span>
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

              <form className="form" onSubmit={handleUpdateMember}>
                <label>
                  이름
                  <input
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    value={displayName}
                  />
                  {fieldErrors.displayName && (
                    <span className="field-error">
                      {fieldErrors.displayName}
                    </span>
                  )}
                </label>
                <label>
                  소모임 닉네임 <span className="optional">(선택)</span>
                  <input
                    onChange={(event) =>
                      setExternalNickname(event.target.value)
                    }
                    value={externalNickname}
                  />
                </label>
                <SelectField
                  label="역할"
                  onChange={(value) => setMemberRole(value as MemberRole)}
                  options={Object.entries(memberRoleLabels).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  value={memberRole}
                />
                <label>
                  가입일
                  <KoreanDateInput
                    onChange={setJoinedOn}
                    required
                    value={joinedOn}
                  />
                  {fieldErrors.joinedOn && (
                    <span className="field-error">{fieldErrors.joinedOn}</span>
                  )}
                </label>
                <label>
                  메모 <span className="optional">(선택)</span>
                  <textarea
                    onChange={(event) => setMemo(event.target.value)}
                    value={memo}
                  />
                </label>
                <button disabled={isReadOnly} type="submit">
                  회원 정보 저장
                </button>
              </form>

              <section
                className="subsection"
                aria-labelledby="membership-status-heading"
              >
                <h3 id="membership-status-heading">회원 상태</h3>
                <p>
                  현재 상태:{' '}
                  <strong>
                    {selectedMember.membershipStatus === 'ACTIVE'
                      ? '활동 중'
                      : '탈퇴'}
                  </strong>
                </p>
                <div className="inline-form">
                  <label>
                    {selectedMember.membershipStatus === 'ACTIVE'
                      ? '탈퇴일'
                      : '재활성화일'}
                    <KoreanDateInput
                      onChange={setMembershipDate}
                      value={membershipDate}
                    />
                  </label>
                  <button
                    className="danger-button"
                    disabled={isReadOnly}
                    onClick={handleMembershipStatusChange}
                    type="button"
                  >
                    {selectedMember.membershipStatus === 'ACTIVE'
                      ? '탈퇴 처리'
                      : '재활성화'}
                  </button>
                </div>
              </section>

              <section
                className="subsection"
                aria-labelledby="activity-exclusion-heading"
              >
                <h3 id="activity-exclusion-heading">활동 중단 기간</h3>
                <p className="description">
                  종료일을 등록하기 전까지 무기한 활동 중단으로 유지됩니다. 기존
                  기간은 사유·시작일·메모를 수정할 수 있습니다.
                </p>
                <form className="form" onSubmit={handleStartExclusion}>
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
                  <label>
                    메모 <span className="optional">(선택)</span>
                    <textarea
                      onChange={(event) => setExclusionNote(event.target.value)}
                      value={exclusionNote}
                    />
                  </label>
                  <div className="form-actions">
                    <button disabled={isReadOnly} type="submit">
                      {editingExclusion === null
                        ? '활동 중단 시작'
                        : '활동 중단 기간 저장'}
                    </button>
                    {editingExclusion && (
                      <button
                        className="secondary-button"
                        disabled={isReadOnly}
                        onClick={cancelExclusionEdit}
                        type="button"
                      >
                        수정 취소
                      </button>
                    )}
                  </div>
                </form>

                <label className="end-date-field">
                  종료 처리일
                  <KoreanDateInput
                    onChange={setExclusionEndDate}
                    value={exclusionEndDate}
                  />
                </label>
                {exclusions.length === 0 ? (
                  <p className="empty-state">
                    등록된 활동 중단 기간이 없습니다.
                  </p>
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
                            className="secondary-button"
                            disabled={isReadOnly}
                            onClick={() => beginExclusionEdit(exclusion)}
                            type="button"
                          >
                            수정
                          </button>
                          {exclusion.endDate === null && (
                            <button
                              className="secondary-button"
                              disabled={isReadOnly}
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
              </section>
              {message && (
                <p className="message" role="status">
                  {message}
                </p>
              )}
            </section>
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
                        <span aria-hidden="true">
                          {memberRoleIcons[selectedMember.memberRole]}
                        </span>
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
                    aria-label="회원 빠른 정보 닫기"
                    className="secondary-button"
                    onClick={() => setIsMemberSheetOpen(false)}
                    type="button"
                  >
                    닫기
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
        <AttendancePage members={members} readOnly={isReadOnly} />
      )}
      {currentPage === 'COUPONS' && (
        <CouponPage members={members} readOnly={isReadOnly} />
      )}
      {currentPage === 'STATISTICS' && <MonthlyStatisticsPage />}
      {currentPage === 'MEETING_NOTES' && (
        <MeetingNotePage readOnly={isReadOnly} />
      )}
      <BottomNav
        active={currentPage}
        items={navigationItems}
        onChange={navigateToPage}
      />
    </main>
  )
}

export default App
