import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import type { Member } from '../../App'
import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'

type GatheringStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
type ParticipationType = 'NORMAL' | 'COUPON'
type AttendanceStatus = 'RECORDED' | 'CANCELLED'

type Gathering = {
  id: string
  heldOn: string
  title: string | null
  startsAt: string | null
  location: string | null
  gatheringStatus: GatheringStatus
  cancelledAt: string | null
  cancellationReason: string | null
}

type CancelledGatheringPage = {
  items: Gathering[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type Attendance = {
  id: string
  gatheringId: string
  memberId: string
  participationType: ParticipationType
  attendanceStatus: AttendanceStatus
  recordedAt: string
  cancelledAt: string | null
  cancellationReason: string | null
}

const today = new Date().toISOString().slice(0, 10)
const weekdayLabels = ['일', '월', '화', '수', '목', '금', '토']

const gatheringStatusLabels: Record<GatheringStatus, string> = {
  DRAFT: '초안',
  OPEN: '출석 진행 중',
  CLOSED: '마감',
  CANCELLED: '취소',
}

const participationLabels: Record<ParticipationType, string> = {
  NORMAL: '일반 출석',
  COUPON: '쿠폰 출석',
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function responseError(response: Response, fallback: string) {
  const body = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  if (body?.message) {
    return new Error(body.message)
  }
  if (response.status === 401 || response.status === 403) {
    return new Error('권한이 없습니다. 관리자 계정으로 다시 로그인해 주세요.')
  }
  return new Error(`${fallback} (HTTP ${response.status})`)
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function formatCalendarDateLabel(year: number, month: number, day: number) {
  return `${year}년 ${month + 1}월 ${day}일`
}

type AttendancePageProps = {
  members: Member[]
  readOnly?: boolean
}

type ModalProps = {
  ariaLabelledBy: string
  children: ReactNode
  onClose: () => void
}

function Modal({ ariaLabelledBy, children, onClose }: ModalProps) {
  return (
    <div className="modal-backdrop">
      <section
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className="modal-content"
        role="dialog"
      >
        <div className="modal-header">
          <button
            aria-label="모달 닫기"
            className="modal-close-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

export function AttendancePage({
  members,
  readOnly = false,
}: AttendancePageProps) {
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [selectedGatheringId, setSelectedGatheringId] = useState<string | null>(
    null,
  )
  const [heldOn, setHeldOn] = useState(today)
  const [isCreateGatheringOpen, setIsCreateGatheringOpen] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date()
    return { year: current.getFullYear(), month: current.getMonth() }
  })
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [memberId, setMemberId] = useState('')
  const [participationType, setParticipationType] =
    useState<ParticipationType>('NORMAL')
  const [historyMemberId, setHistoryMemberId] = useState('')
  const [historyAttendances, setHistoryAttendances] = useState<Attendance[]>([])
  const [cancellingAttendanceId, setCancellingAttendanceId] = useState<
    string | null
  >(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [message, setMessage] = useState('')
  const [createGatheringError, setCreateGatheringError] = useState('')
  const [isCreatingGathering, setIsCreatingGathering] = useState(false)
  const [isGatheringCancellationOpen, setIsGatheringCancellationOpen] =
    useState(false)
  const [gatheringCancellationReason, setGatheringCancellationReason] =
    useState('')
  const [gatheringCancellationError, setGatheringCancellationError] =
    useState('')
  const [isCancellationHistoryOpen, setIsCancellationHistoryOpen] =
    useState(false)
  const [cancelledGatherings, setCancelledGatherings] = useState<Gathering[]>(
    [],
  )
  const [cancellationHistoryPage, setCancellationHistoryPage] = useState(0)
  const [cancellationHistoryTotalPages, setCancellationHistoryTotalPages] =
    useState(0)
  const [
    cancellationHistoryTotalElements,
    setCancellationHistoryTotalElements,
  ] = useState(0)
  const [isCancellationHistoryLoading, setIsCancellationHistoryLoading] =
    useState(false)
  const [cancellationHistoryError, setCancellationHistoryError] = useState('')

  const selectedGathering = useMemo(
    () =>
      gatherings.find((gathering) => gathering.id === selectedGatheringId) ??
      null,
    [gatherings, selectedGatheringId],
  )
  const activeMembers = members.filter(
    (member) => member.membershipStatus === 'ACTIVE',
  )
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(
      calendarMonth.year,
      calendarMonth.month,
      1,
    ).getDay()
    const lastDay = new Date(
      calendarMonth.year,
      calendarMonth.month + 1,
      0,
    ).getDate()

    return Array.from({ length: firstDayOfWeek + lastDay }, (_, index) => {
      if (index < firstDayOfWeek) {
        return null
      }
      const day = index - firstDayOfWeek + 1
      const date = formatDate(calendarMonth.year, calendarMonth.month, day)
      return {
        day,
        date,
        gatherings: gatherings.filter((gathering) => gathering.heldOn === date),
      }
    })
  }, [calendarMonth, gatherings])

  useEffect(() => {
    void refreshGatherings()
    // The first load is intentionally separate from manual refresh controls.
  }, [])

  function moveCalendarMonth(amount: number) {
    setCalendarMonth((previous) => {
      const next = new Date(previous.year, previous.month + amount, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function moveToCurrentMonth() {
    const current = new Date()
    setCalendarMonth({ year: current.getFullYear(), month: current.getMonth() })
  }

  function selectCalendarDate(date: string) {
    if (readOnly) {
      return
    }
    setHeldOn(date)
    setIsCreateGatheringOpen(true)
    setMessage(`${date} 날짜의 출석부 생성 창을 열었습니다.`)
  }

  async function refreshGatherings() {
    try {
      const response = await fetch('/api/v1/gatherings', {
        credentials: 'include',
      })
      if (!response.ok) {
        throw await responseError(
          response,
          '출석부 목록을 불러오지 못했습니다.',
        )
      }
      setGatherings((await response.json()) as Gathering[])
      setMessage('출석부 목록을 새로고침했습니다.')
    } catch (error) {
      setMessage(errorMessage(error, '출석부 목록을 불러오지 못했습니다.'))
    }
  }

  async function loadCancellationHistory(page = 0) {
    setIsCancellationHistoryLoading(true)
    setCancellationHistoryError('')
    try {
      const response = await fetch(
        `/api/v1/gatherings/cancellations?page=${page}&size=10`,
        { credentials: 'include' },
      )
      if (!response.ok) {
        throw await responseError(response, '취소 이력을 불러오지 못했습니다.')
      }
      const result = (await response.json()) as CancelledGatheringPage
      setCancelledGatherings(result.items)
      setCancellationHistoryPage(result.page)
      setCancellationHistoryTotalPages(result.totalPages)
      setCancellationHistoryTotalElements(result.totalElements)
    } catch (error) {
      setCancellationHistoryError(
        errorMessage(error, '취소 이력을 불러오지 못했습니다.'),
      )
    } finally {
      setIsCancellationHistoryLoading(false)
    }
  }

  function openCancellationHistory() {
    setIsCancellationHistoryOpen(true)
    setCancellationHistoryError('')
    void loadCancellationHistory()
  }

  async function selectGathering(gathering: Gathering) {
    setSelectedGatheringId(gathering.id)
    setMessage('')
    try {
      const response = await fetch(
        `/api/v1/gatherings/${gathering.id}/attendances`,
        {
          credentials: 'include',
        },
      )
      if (!response.ok) {
        throw new Error('출석 기록을 불러오지 못했습니다.')
      }
      setAttendances((await response.json()) as Attendance[])
    } catch (error) {
      setMessage(errorMessage(error, '출석 기록을 불러오지 못했습니다.'))
    }
  }

  async function createGathering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setCreateGatheringError('')
    setIsCreatingGathering(true)
    const payload = {
      heldOn,
      title: title || null,
      startsAt: null,
      location: location || null,
    }

    try {
      const response = await fetch('/api/v1/gatherings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        throw await responseError(response, '출석부를 만들지 못했습니다.')
      }
      const gathering = (await response.json()) as Gathering
      setGatherings((previous) => [gathering, ...previous])
      setSelectedGatheringId(gathering.id)
      setIsCreateGatheringOpen(false)
      setTitle('')
      setLocation('')
      setMessage('출석부 초안을 만들었습니다.')
    } catch (error) {
      setCreateGatheringError(
        errorMessage(error, '출석부를 만들지 못했습니다.'),
      )
    } finally {
      setIsCreatingGathering(false)
    }
  }

  async function changeGatheringStatus(action: 'open' | 'close') {
    if (selectedGathering === null) {
      return
    }

    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedGathering.id}/${action}`,
        { method: 'POST', credentials: 'include' },
      )
      if (!response.ok) {
        throw new Error('출석부 상태를 변경하지 못했습니다.')
      }
      const updated = (await response.json()) as Gathering
      setGatherings((previous) =>
        previous.map((gathering) =>
          gathering.id === updated.id ? updated : gathering,
        ),
      )
      setMessage(
        `출석부 상태를 ${gatheringStatusLabels[updated.gatheringStatus]}(으)로 변경했습니다.`,
      )
    } catch (error) {
      setMessage(errorMessage(error, '출석부 상태를 변경하지 못했습니다.'))
    }
  }

  async function cancelGathering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedGathering === null) {
      return
    }
    if (gatheringCancellationReason.trim() === '') {
      setGatheringCancellationError('모임 취소 사유를 입력해 주세요.')
      return
    }

    setGatheringCancellationError('')
    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedGathering.id}/cancel`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cancellationReason: gatheringCancellationReason.trim(),
          }),
        },
      )
      if (!response.ok) {
        throw await responseError(response, '모임을 취소하지 못했습니다.')
      }
      const cancelled = (await response.json()) as Gathering
      setGatherings((previous) =>
        previous.filter((gathering) => gathering.id !== cancelled.id),
      )
      setSelectedGatheringId(null)
      setAttendances([])
      setIsGatheringCancellationOpen(false)
      setGatheringCancellationReason('')
      setMessage(
        '모임을 취소했습니다. 취소 이력에서 사유를 확인할 수 있습니다.',
      )
    } catch (error) {
      setGatheringCancellationError(
        errorMessage(error, '모임을 취소하지 못했습니다.'),
      )
    }
  }

  async function recordAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedGathering === null || memberId === '') {
      setMessage('출석부와 회원을 선택해 주세요.')
      return
    }

    const payload = { memberId, participationType }
    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedGathering.id}/attendances`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        throw new Error('출석 기록을 추가하지 못했습니다.')
      }
      const attendance = (await response.json()) as Attendance
      setAttendances((previous) => [...previous, attendance])
      setMessage('출석 기록을 추가했습니다.')
    } catch (error) {
      setMessage(errorMessage(error, '출석 기록을 추가하지 못했습니다.'))
    }
  }

  async function loadMemberHistory() {
    if (historyMemberId === '') {
      setMessage('출석 이력을 조회할 회원을 선택해 주세요.')
      return
    }

    try {
      const [historyResponse, gatheringsResponse] = await Promise.all([
        fetch(`/api/v1/members/${historyMemberId}/attendance-history`, {
          credentials: 'include',
        }),
        fetch('/api/v1/gatherings', { credentials: 'include' }),
      ])
      if (!historyResponse.ok || !gatheringsResponse.ok) {
        throw new Error('회원 출석 이력을 불러오지 못했습니다.')
      }
      setHistoryAttendances((await historyResponse.json()) as Attendance[])
      setGatherings((await gatheringsResponse.json()) as Gathering[])
      setMessage('회원 출석 이력을 조회했습니다.')
    } catch (error) {
      setMessage(errorMessage(error, '회원 출석 이력을 불러오지 못했습니다.'))
    }
  }

  async function cancelAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedGathering === null || cancellingAttendanceId === null) {
      return
    }
    if (cancellationReason.trim() === '') {
      setMessage('출석 취소 사유를 입력해 주세요.')
      return
    }

    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedGathering.id}/attendances/${cancellingAttendanceId}/cancel`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cancellationReason: cancellationReason.trim(),
          }),
        },
      )
      if (!response.ok) {
        throw new Error('출석 기록을 취소하지 못했습니다.')
      }
      const cancelled = (await response.json()) as Attendance
      const updateAttendance = (attendance: Attendance) =>
        attendance.id === cancelled.id ? cancelled : attendance
      setAttendances((previous) => previous.map(updateAttendance))
      setHistoryAttendances((previous) => previous.map(updateAttendance))
      setCancellingAttendanceId(null)
      setCancellationReason('')
      setMessage('출석 기록을 취소했습니다. 기록은 보존됩니다.')
    } catch (error) {
      setMessage(errorMessage(error, '출석 기록을 취소하지 못했습니다.'))
    }
  }

  const selectedAttendances = attendances.filter(
    (attendance) => attendance.gatheringId === selectedGatheringId,
  )

  return (
    <section className="attendance-page" aria-labelledby="attendance-heading">
      <div className="attendance-page-heading">
        <div>
          <h2 id="attendance-heading">출석 관리</h2>
          <p className="description">
            날짜별 출석부를 열고 회원별 참여 방식을 기록합니다.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            onClick={openCancellationHistory}
            type="button"
          >
            취소 이력 보기
          </button>
          <button
            className="secondary-button"
            onClick={() => void refreshGatherings()}
            type="button"
          >
            새로고침
          </button>
        </div>
      </div>

      <section
        className="panel attendance-calendar"
        aria-labelledby="calendar-heading"
      >
        <div className="panel-heading">
          <div>
            <h3 id="calendar-heading">출석 캘린더</h3>
            <p>
              날짜를 눌러 출석부 생성 날짜를 선택하거나, 표시된 출석부를 바로
              엽니다.
            </p>
          </div>
          <div className="calendar-navigation">
            <button
              className="secondary-button"
              onClick={() => moveCalendarMonth(-1)}
              type="button"
            >
              이전 달
            </button>
            <strong aria-live="polite">
              {calendarMonth.year}년 {calendarMonth.month + 1}월
            </strong>
            <button
              className="secondary-button"
              onClick={() => moveCalendarMonth(1)}
              type="button"
            >
              다음 달
            </button>
            <button
              className="secondary-button"
              onClick={moveToCurrentMonth}
              type="button"
            >
              이번 달
            </button>
          </div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {weekdayLabels.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarDays.map((calendarDay, index) =>
            calendarDay === null ? (
              <div
                aria-hidden="true"
                className="calendar-empty-cell"
                key={`empty-${index}`}
              />
            ) : (
              <div
                className={`calendar-day ${heldOn === calendarDay.date ? 'calendar-day-selected' : ''}`}
                key={calendarDay.date}
              >
                <button
                  aria-label={`${formatCalendarDateLabel(calendarMonth.year, calendarMonth.month, calendarDay.day)} 선택`}
                  aria-pressed={heldOn === calendarDay.date}
                  className="calendar-date-button"
                  disabled={readOnly && calendarDay.gatherings.length === 0}
                  onClick={() => selectCalendarDate(calendarDay.date)}
                  type="button"
                >
                  {calendarDay.day}
                </button>
                <div className="calendar-gatherings">
                  {calendarDay.gatherings.map((gathering) => (
                    <button
                      className={`calendar-gathering gathering-status-${gathering.gatheringStatus.toLowerCase()}`}
                      key={gathering.id}
                      onClick={() => void selectGathering(gathering)}
                      type="button"
                    >
                      {gathering.title ??
                        gatheringStatusLabels[gathering.gatheringStatus]}
                    </button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <div className="attendance-grid">
        {!readOnly && (
          <section className="panel">
            <h3>새 출석부</h3>
            <p className="description">
              캘린더의 날짜를 누르거나 아래 버튼을 눌러 출석부를 만듭니다.
            </p>
            <button
              onClick={() => setIsCreateGatheringOpen(true)}
              type="button"
            >
              새 출석부 만들기
            </button>
          </section>
        )}

        <section className="panel">
          <h3>출석부 목록</h3>
          {gatherings.length === 0 ? (
            <p className="empty-state">아직 만든 출석부가 없습니다.</p>
          ) : (
            <ul className="gathering-list">
              {gatherings.map((gathering) => (
                <li key={gathering.id}>
                  <button
                    className={`gathering-row ${selectedGatheringId === gathering.id ? 'selected' : ''}`}
                    onClick={() => void selectGathering(gathering)}
                    type="button"
                  >
                    <span>
                      <strong>{gathering.heldOn}</strong>
                      {gathering.title && ` · ${gathering.title}`}
                    </span>
                    <span
                      className={`status gathering-status-${gathering.gatheringStatus.toLowerCase()}`}
                    >
                      {gatheringStatusLabels[gathering.gatheringStatus]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {isCreateGatheringOpen && (
        <Modal
          ariaLabelledBy="create-gathering-heading"
          onClose={() => setIsCreateGatheringOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="create-gathering-heading">새 출석부 만들기</h3>
            <p>모임 정보를 입력하면 초안 상태의 출석부가 생성됩니다.</p>
          </div>
          <form className="form" onSubmit={createGathering}>
            <label>
              모임 날짜
              <input
                onChange={(event) => setHeldOn(event.target.value)}
                required
                type="date"
                value={heldOn}
              />
            </label>
            <label>
              제목 <span className="optional">(선택)</span>
              <input
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <label>
              장소 <span className="optional">(선택)</span>
              <input
                onChange={(event) => setLocation(event.target.value)}
                value={location}
              />
            </label>
            <div className="form-actions">
              <button disabled={isCreatingGathering} type="submit">
                {isCreatingGathering ? '출석부 생성 중…' : '출석부 초안 만들기'}
              </button>
              <button
                className="secondary-button"
                onClick={() => setIsCreateGatheringOpen(false)}
                type="button"
              >
                취소
              </button>
            </div>
            {createGatheringError && (
              <p className="field-error" role="alert">
                {createGatheringError}
              </p>
            )}
          </form>
        </Modal>
      )}

      <section className="panel attendance-history">
        <h3>회원별 출석 이력</h3>
        <div className="attendance-history-controls">
          <SearchableMemberSelect
            includeWithdrawn
            label="회원"
            members={members}
            onChange={setHistoryMemberId}
            value={historyMemberId}
          />
          <button onClick={() => void loadMemberHistory()} type="button">
            이력 조회
          </button>
        </div>
        {historyMemberId !== '' && historyAttendances.length === 0 ? (
          <p className="empty-state">조회된 출석 이력이 없습니다.</p>
        ) : (
          <ul className="attendance-list">
            {historyAttendances.map((attendance) => {
              const gathering = gatherings.find(
                (item) => item.id === attendance.gatheringId,
              )
              return (
                <li key={attendance.id}>
                  <strong>{gathering?.heldOn ?? '날짜를 불러오는 중'}</strong>
                  <span>
                    {participationLabels[attendance.participationType]}
                  </span>
                  <span>
                    {attendance.attendanceStatus === 'RECORDED'
                      ? '기록됨'
                      : `취소됨: ${attendance.cancellationReason}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {selectedGathering && (
        <Modal
          ariaLabelledBy="attendance-detail-heading"
          onClose={() => {
            setSelectedGatheringId(null)
            setCancellingAttendanceId(null)
            setIsGatheringCancellationOpen(false)
          }}
        >
          <section className="attendance-detail">
            <div className="panel-heading">
              <div>
                <h3 id="attendance-detail-heading">
                  {selectedGathering.heldOn} 출석부
                </h3>
                <p>
                  {selectedGathering.location ?? '장소 미입력'} ·{' '}
                  {gatheringStatusLabels[selectedGathering.gatheringStatus]}
                </p>
              </div>
              {!readOnly && (
                <div className="form-actions">
                  {selectedGathering.gatheringStatus === 'DRAFT' && (
                    <button
                      onClick={() => void changeGatheringStatus('open')}
                      type="button"
                    >
                      출석 시작
                    </button>
                  )}
                  {selectedGathering.gatheringStatus === 'OPEN' && (
                    <button
                      onClick={() => void changeGatheringStatus('close')}
                      type="button"
                    >
                      출석 마감
                    </button>
                  )}
                  {selectedGathering.gatheringStatus !== 'CLOSED' &&
                    selectedGathering.gatheringStatus !== 'CANCELLED' && (
                      <button
                        className="danger-button"
                        onClick={() => {
                          setGatheringCancellationReason('')
                          setGatheringCancellationError('')
                          setIsGatheringCancellationOpen(true)
                        }}
                        type="button"
                      >
                        모임 취소
                      </button>
                    )}
                </div>
              )}
            </div>

            {!readOnly && selectedGathering.gatheringStatus === 'OPEN' && (
              <form
                className="attendance-record-form"
                onSubmit={recordAttendance}
              >
                <SearchableMemberSelect
                  label="회원"
                  members={activeMembers}
                  onChange={setMemberId}
                  required
                  value={memberId}
                />
                <label>
                  참여 방식
                  <select
                    onChange={(event) =>
                      setParticipationType(
                        event.target.value as ParticipationType,
                      )
                    }
                    value={participationType}
                  >
                    {Object.entries(participationLabels).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button type="submit">출석 기록</button>
              </form>
            )}

            {selectedAttendances.length === 0 ? (
              <p className="empty-state">기록된 출석이 없습니다.</p>
            ) : (
              <ul className="attendance-list">
                {selectedAttendances.map((attendance) => {
                  const member = members.find(
                    (item) => item.id === attendance.memberId,
                  )
                  return (
                    <Fragment key={attendance.id}>
                      <li>
                        <strong>
                          {member?.displayName ?? '알 수 없는 회원'}
                        </strong>
                        <span>
                          {participationLabels[attendance.participationType]}
                        </span>
                        <span>
                          {attendance.attendanceStatus === 'RECORDED'
                            ? '기록됨'
                            : '취소됨'}
                        </span>
                        {!readOnly &&
                          attendance.attendanceStatus === 'RECORDED' && (
                            <button
                              className="secondary-button"
                              onClick={() => {
                                setCancellingAttendanceId(attendance.id)
                                setCancellationReason('')
                              }}
                              type="button"
                            >
                              출석 취소
                            </button>
                          )}
                      </li>
                      {cancellingAttendanceId === attendance.id && (
                        <li className="attendance-cancel-form">
                          <form
                            className="inline-form"
                            onSubmit={cancelAttendance}
                          >
                            <label>
                              출석 취소 사유
                              <input
                                onChange={(event) =>
                                  setCancellationReason(event.target.value)
                                }
                                required
                                value={cancellationReason}
                              />
                            </label>
                            <button className="danger-button" type="submit">
                              취소 확정
                            </button>
                            <button
                              className="secondary-button"
                              onClick={() => setCancellingAttendanceId(null)}
                              type="button"
                            >
                              닫기
                            </button>
                          </form>
                        </li>
                      )}
                    </Fragment>
                  )
                })}
              </ul>
            )}
          </section>
        </Modal>
      )}

      {isGatheringCancellationOpen && selectedGathering && (
        <Modal
          ariaLabelledBy="cancel-gathering-heading"
          onClose={() => setIsGatheringCancellationOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="cancel-gathering-heading">모임을 취소할까요?</h3>
            <p>
              {selectedGathering.heldOn} {selectedGathering.title ?? '정모'}는
              기본 목록에서 숨겨지고 취소 이력에 보관됩니다.
            </p>
          </div>
          <form className="form" onSubmit={cancelGathering}>
            <label>
              취소 사유
              <textarea
                maxLength={1000}
                onChange={(event) =>
                  setGatheringCancellationReason(event.target.value)
                }
                required
                rows={4}
                value={gatheringCancellationReason}
              />
            </label>
            <div className="form-actions">
              <button className="danger-button" type="submit">
                모임 취소
              </button>
              <button
                className="secondary-button"
                onClick={() => setIsGatheringCancellationOpen(false)}
                type="button"
              >
                돌아가기
              </button>
            </div>
            {gatheringCancellationError && (
              <p className="field-error" role="alert">
                {gatheringCancellationError}
              </p>
            )}
          </form>
        </Modal>
      )}

      {isCancellationHistoryOpen && (
        <Modal
          ariaLabelledBy="cancellation-history-heading"
          onClose={() => setIsCancellationHistoryOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="cancellation-history-heading">취소 이력</h3>
            <p>취소된 정모와 사유를 최근 취소 순서로 확인합니다.</p>
          </div>
          {isCancellationHistoryLoading ? (
            <p className="empty-state">취소 이력을 불러오는 중입니다.</p>
          ) : cancellationHistoryError ? (
            <p className="field-error" role="alert">
              {cancellationHistoryError}
            </p>
          ) : cancelledGatherings.length === 0 ? (
            <p className="empty-state">취소된 정모가 없습니다.</p>
          ) : (
            <ul className="cancellation-history-list">
              {cancelledGatherings.map((gathering) => (
                <li key={gathering.id}>
                  <div>
                    <strong>{gathering.heldOn}</strong>
                    <span>{gathering.title ?? '제목 없는 정모'}</span>
                  </div>
                  <p>{gathering.cancellationReason}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="pagination-controls">
            <button
              className="secondary-button"
              disabled={
                isCancellationHistoryLoading || cancellationHistoryPage === 0
              }
              onClick={() =>
                void loadCancellationHistory(cancellationHistoryPage - 1)
              }
              type="button"
            >
              이전
            </button>
            <span>
              {cancellationHistoryTotalElements === 0
                ? '0건'
                : `${cancellationHistoryPage + 1} / ${cancellationHistoryTotalPages} 페이지`}
            </span>
            <button
              className="secondary-button"
              disabled={
                isCancellationHistoryLoading ||
                cancellationHistoryPage + 1 >= cancellationHistoryTotalPages
              }
              onClick={() =>
                void loadCancellationHistory(cancellationHistoryPage + 1)
              }
              type="button"
            >
              다음
            </button>
          </div>
        </Modal>
      )}
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
