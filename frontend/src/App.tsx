import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { AttendancePage } from './features/attendance/AttendancePage'
import { CouponPage } from './features/coupon/CouponPage'
import { MeetingNotePage } from './features/meetingnote/MeetingNotePage'
import { MonthlyStatisticsPage } from './features/statistics/MonthlyStatisticsPage'
import { apiFetch as fetch } from './shared/api/apiFetch'
import { useFeedbackDialog } from './shared/feedback-dialog/useFeedbackDialog'
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

type MemberFilter = 'ALL' | Member['membershipStatus']
type MemberSort = 'NAME_ASC' | 'JOINED_ON_DESC'
type MemberRole = Member['memberRole']

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

function App() {
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [currentLoginId, setCurrentLoginId] = useState<string | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isMemberSheetOpen, setIsMemberSheetOpen] = useState(false)
  const [isMemberDetailPage, setIsMemberDetailPage] = useState(false)
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
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('ALL')
  const [memberSort, setMemberSort] = useState<MemberSort>('NAME_ASC')
  const [currentPage, setCurrentPage] = useState<
    'MEMBERS' | 'ATTENDANCE' | 'COUPONS' | 'STATISTICS' | 'MEETING_NOTES'
  >('MEMBERS')

  const visibleMembers = useMemo(() => {
    const normalizedSearch = memberSearch.trim().toLocaleLowerCase()
    return [...members]
      .filter(
        (member) =>
          memberFilter === 'ALL' || member.membershipStatus === memberFilter,
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
        if (memberSort === 'JOINED_ON_DESC') {
          return right.joinedOn.localeCompare(left.joinedOn)
        }
        return left.displayName.localeCompare(right.displayName, 'ko')
      })
  }, [memberFilter, memberSearch, memberSort, members])

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

      const account = (await response.json()) as { loginId: string }
      setCurrentLoginId(account.loginId)
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
    setPassword('')
    await loadMembers()
  }

  async function handleCreateMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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
    setMessage('회원을 등록했습니다.')
    showFeedbackDialog({
      title: '회원 등록 완료',
      message: `${createdMember.displayName}님을 ${memberRoleLabels[createdMember.memberRole]}으로 등록했습니다.`,
    })
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
        <section className="login-card" aria-labelledby="login-heading">
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
          {message && selectedMember === null && (
            <p className="message" role="status">
              {message}
            </p>
          )}
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MOING MOING</p>
          <h1>{currentPage === 'MEMBERS' ? '회원 관리' : '출석 관리'}</h1>
        </div>
        <div className="account-actions">
          <span>{currentLoginId}</span>
          <button
            className="secondary-button"
            onClick={handleLogout}
            type="button"
          >
            로그아웃
          </button>
        </div>
      </header>

      <nav className="primary-navigation" aria-label="주요 메뉴">
        <button
          className={
            currentPage === 'MEMBERS' ? 'navigation-active' : 'secondary-button'
          }
          onClick={() => setCurrentPage('MEMBERS')}
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
          onClick={() => setCurrentPage('ATTENDANCE')}
          type="button"
        >
          출석 관리
        </button>
        <button
          className={
            currentPage === 'COUPONS' ? 'navigation-active' : 'secondary-button'
          }
          onClick={() => setCurrentPage('COUPONS')}
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
          onClick={() => setCurrentPage('STATISTICS')}
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
          onClick={() => setCurrentPage('MEETING_NOTES')}
          type="button"
        >
          회의록
        </button>
      </nav>

      {currentPage === 'MEMBERS' && (
        <section
          className={isMemberDetailPage ? 'member-page' : 'content-grid'}
        >
          {!isMemberDetailPage && (
            <>
              <section
                className="panel"
                aria-labelledby="member-create-heading"
              >
                <h2 id="member-create-heading">새 회원 등록</h2>
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
                  <label>
                    역할
                    <select
                      onChange={(event) =>
                        setMemberRole(event.target.value as MemberRole)
                      }
                      value={memberRole}
                    >
                      {Object.entries(memberRoleLabels).map(([role, label]) => (
                        <option key={role} value={role}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    가입일
                    <input
                      onChange={(event) => setJoinedOn(event.target.value)}
                      required
                      type="date"
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

              <section className="panel" aria-labelledby="member-list-heading">
                <div className="panel-heading">
                  <div>
                    <h2 id="member-list-heading">현재 회원</h2>
                    <p>
                      {visibleMembers.length}명 / 전체 {members.length}명
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => void loadMembers()}
                    type="button"
                  >
                    새로고침
                  </button>
                </div>
                <div className="member-list-controls">
                  <label>
                    회원 검색
                    <input
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="이름 또는 닉네임"
                      value={memberSearch}
                    />
                  </label>
                  <label>
                    회원 상태
                    <select
                      onChange={(event) =>
                        setMemberFilter(event.target.value as MemberFilter)
                      }
                      value={memberFilter}
                    >
                      <option value="ALL">전체</option>
                      <option value="ACTIVE">활동 중</option>
                      <option value="WITHDRAWN">탈퇴</option>
                    </select>
                  </label>
                  <label>
                    정렬
                    <select
                      onChange={(event) =>
                        setMemberSort(event.target.value as MemberSort)
                      }
                      value={memberSort}
                    >
                      <option value="NAME_ASC">이름순</option>
                      <option value="JOINED_ON_DESC">가입일 최신순</option>
                    </select>
                  </label>
                </div>
                {visibleMembers.length === 0 ? (
                  <p className="empty-state">조건에 맞는 회원이 없습니다.</p>
                ) : (
                  <ul className="member-list">
                    {visibleMembers.map((member) => (
                      <li key={member.id}>
                        <button
                          className="member-row"
                          onClick={() => void selectMember(member)}
                          type="button"
                        >
                          <div>
                            <strong>{member.displayName}</strong>
                            <span>
                              {memberRoleLabels[member.memberRole]}
                              {member.externalNickname &&
                                ` · ${member.externalNickname}`}
                            </span>
                          </div>
                          <span
                            className={`status status-${member.membershipStatus.toLowerCase()}`}
                          >
                            {member.membershipStatus === 'ACTIVE'
                              ? '활동 중'
                              : '탈퇴'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
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
                  <p>{selectedMember.displayName}</p>
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
                <label>
                  역할
                  <select
                    onChange={(event) =>
                      setMemberRole(event.target.value as MemberRole)
                    }
                    value={memberRole}
                  >
                    {Object.entries(memberRoleLabels).map(([role, label]) => (
                      <option key={role} value={role}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  가입일
                  <input
                    onChange={(event) => setJoinedOn(event.target.value)}
                    required
                    type="date"
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
                <button type="submit">회원 정보 저장</button>
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
                    <input
                      onChange={(event) =>
                        setMembershipDate(event.target.value)
                      }
                      type="date"
                      value={membershipDate}
                    />
                  </label>
                  <button
                    className="danger-button"
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
                  <label>
                    사유
                    <select
                      onChange={(event) =>
                        setExclusionReason(
                          event.target.value as ActivityExclusionReason,
                        )
                      }
                      value={exclusionReason}
                    >
                      {Object.entries(activityExclusionReasonLabels).map(
                        ([reason, label]) => (
                          <option key={reason} value={reason}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    시작일
                    <input
                      onChange={(event) =>
                        setExclusionStartDate(event.target.value)
                      }
                      required
                      type="date"
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
                    <button type="submit">
                      {editingExclusion === null
                        ? '활동 중단 시작'
                        : '활동 중단 기간 저장'}
                    </button>
                    {editingExclusion && (
                      <button
                        className="secondary-button"
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
                  <input
                    onChange={(event) =>
                      setExclusionEndDate(event.target.value)
                    }
                    type="date"
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
                            onClick={() => beginExclusionEdit(exclusion)}
                            type="button"
                          >
                            수정
                          </button>
                          {exclusion.endDate === null && (
                            <button
                              className="secondary-button"
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
                      {memberRoleLabels[selectedMember.memberRole]}
                      {' · '}
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
                    <dd>{selectedMember.joinedOn}</dd>
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
      {currentPage === 'ATTENDANCE' && <AttendancePage members={members} />}
      {currentPage === 'COUPONS' && <CouponPage members={members} />}
      {currentPage === 'STATISTICS' && <MonthlyStatisticsPage />}
      {currentPage === 'MEETING_NOTES' && <MeetingNotePage />}
    </main>
  )
}

export default App
