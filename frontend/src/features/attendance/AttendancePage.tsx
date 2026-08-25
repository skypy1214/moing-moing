import { Fragment, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import type { Member } from '../../App'
import { GatheringForm } from './GatheringForm'
import type { GatheringType } from './GatheringForm'
import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { useFeedbackDialog } from '../../shared/feedback-dialog/useFeedbackDialog'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'
import { EmptyState } from '../../shared/ui/EmptyState'
import { RefreshIcon } from '../../shared/ui/RefreshIcon'
import { Modal } from '../../shared/ui/Modal'

type GatheringStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
type ParticipationType = 'NORMAL' | 'COUPON' | 'HOST'
type AttendanceStatus = 'RECORDED' | 'CANCELLED'
type GatheringFilter = 'ALL' | 'OPEN' | 'CLOSED'

type Gathering = {
  id: string
  heldOn: string
  gatheringType: GatheringType
  endsOn: string | null
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
const monthLabels = Array.from({ length: 12 }, (_, index) => `${index + 1}월`)

const gatheringStatusLabels: Record<GatheringStatus, string> = {
  DRAFT: '초안',
  OPEN: '출석 진행 중',
  CLOSED: '마감',
  CANCELLED: '취소',
}

const gatheringTypeLabels: Record<GatheringType, string> = {
  CLASS: '수업',
  EVENT: '행사',
}

function isGatheringOnDate(gathering: Gathering, date: string) {
  return (
    gathering.heldOn <= date &&
    date <=
      (gathering.gatheringType === 'EVENT'
        ? (gathering.endsOn ?? gathering.heldOn)
        : gathering.heldOn)
  )
}

function gatheringPeriodLabel(gathering: Gathering) {
  if (gathering.gatheringType === 'EVENT' && gathering.endsOn !== null) {
    return `${gathering.heldOn} ~ ${gathering.endsOn}`
  }
  return gathering.heldOn
}

function normalizeGathering(
  gathering: Partial<Gathering> &
    Pick<Gathering, 'id' | 'heldOn' | 'gatheringStatus'>,
): Gathering {
  return {
    ...gathering,
    gatheringType: gathering.gatheringType ?? 'CLASS',
    endsOn: gathering.endsOn ?? null,
    title: gathering.title ?? null,
    startsAt: gathering.startsAt ?? null,
    location: gathering.location ?? null,
    cancelledAt: gathering.cancelledAt ?? null,
    cancellationReason: gathering.cancellationReason ?? null,
  }
}

const participationLabels: Record<ParticipationType, string> = {
  NORMAL: '출석',
  COUPON: '쿠폰',
  HOST: '진행자',
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

export function AttendancePage({
  members,
  readOnly = false,
}: AttendancePageProps) {
  const { confirm } = useFeedbackDialog()
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [selectedGatheringId, setSelectedGatheringId] = useState<string | null>(
    null,
  )
  const [heldOn, setHeldOn] = useState(today)
  const [gatheringType, setGatheringType] = useState<GatheringType>('CLASS')
  const [endsOn, setEndsOn] = useState(today)
  const [hostMemberId, setHostMemberId] = useState('')
  const [isCreateGatheringOpen, setIsCreateGatheringOpen] = useState(false)
  const [isEditGatheringOpen, setIsEditGatheringOpen] = useState(false)
  const [editHeldOn, setEditHeldOn] = useState(today)
  const [editGatheringType, setEditGatheringType] =
    useState<GatheringType>('CLASS')
  const [editEndsOn, setEditEndsOn] = useState(today)
  const [editHostMemberId, setEditHostMemberId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editGatheringError, setEditGatheringError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date()
    return { year: current.getFullYear(), month: current.getMonth() }
  })
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [memberId, setMemberId] = useState('')
  const [historyMemberId, setHistoryMemberId] = useState('')
  const [historyAttendances, setHistoryAttendances] = useState<Attendance[]>([])
  const [hasLoadedMemberHistory, setHasLoadedMemberHistory] = useState(false)
  const [isMemberHistoryOpen, setIsMemberHistoryOpen] = useState(false)
  const [gatheringFilter, setGatheringFilter] =
    useState<GatheringFilter>('OPEN')
  const [cancellingAttendanceId, setCancellingAttendanceId] = useState<
    string | null
  >(null)
  const [cancellationReason, setCancellationReason] = useState('')
  const [, setMessage] = useState('')
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
  const membersById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  )
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(
      calendarMonth.year,
      calendarMonth.month,
      1,
    ).getDay()
    const daysInMonth = new Date(
      calendarMonth.year,
      calendarMonth.month + 1,
      0,
    ).getDate()
    const numberOfWeeks = Math.ceil((firstDayOfWeek + daysInMonth) / 7)
    const firstVisibleDate = new Date(
      calendarMonth.year,
      calendarMonth.month,
      1 - firstDayOfWeek,
    )

    return Array.from({ length: numberOfWeeks * 7 }, (_, index) => {
      const dateValue = new Date(firstVisibleDate)
      dateValue.setDate(firstVisibleDate.getDate() + index)
      const year = dateValue.getFullYear()
      const month = dateValue.getMonth()
      const day = dateValue.getDate()
      const date = formatDate(year, month, day)
      return {
        day,
        date,
        year,
        month,
        isOutsideMonth: month !== calendarMonth.month,
        gatherings: gatherings.filter((gathering) =>
          isGatheringOnDate(gathering, date),
        ),
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

  function selectCalendarMonth(month: number) {
    setCalendarMonth((previous) => ({ ...previous, month }))
    setIsMonthPickerOpen(false)
  }

  function selectCalendarDate(date: string) {
    if (readOnly) {
      return
    }
    const selectedDate = new Date(`${date}T00:00:00`)
    setCalendarMonth({
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth(),
    })
    setHeldOn(date)
    setGatheringType('CLASS')
    setEndsOn(date)
    setHostMemberId('')
    setIsCreateGatheringOpen(true)
    setMessage(`${date} 날짜의 정모 개설 창을 열었습니다.`)
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
      setGatherings(
        ((await response.json()) as Gathering[]).map(normalizeGathering),
      )
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
      setCancelledGatherings(result.items.map(normalizeGathering))
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

  async function loadAttendances(gatheringId: string) {
    try {
      const response = await fetch(
        `/api/v1/gatherings/${gatheringId}/attendances`,
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

  async function selectGathering(gathering: Gathering) {
    setSelectedGatheringId(gathering.id)
    setMessage('')
    await loadAttendances(gathering.id)
  }

  async function createGathering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setCreateGatheringError('')
    setIsCreatingGathering(true)
    const payload = {
      heldOn,
      gatheringType,
      endsOn: gatheringType === 'EVENT' ? endsOn : null,
      hostMemberId:
        gatheringType === 'CLASS' && hostMemberId !== '' ? hostMemberId : null,
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
      const gathering = normalizeGathering((await response.json()) as Gathering)
      setGatherings((previous) => [gathering, ...previous])
      setSelectedGatheringId(gathering.id)
      setIsCreateGatheringOpen(false)
      setTitle('')
      setLocation('')
      setGatheringType('CLASS')
      setEndsOn(heldOn)
      setHostMemberId('')
      setMessage('정모를 개설했습니다.')
    } catch (error) {
      setCreateGatheringError(
        errorMessage(error, '출석부를 만들지 못했습니다.'),
      )
    } finally {
      setIsCreatingGathering(false)
    }
  }

  async function changeGatheringStatus(action: 'open' | 'close' | 'reopen') {
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
      const updated = normalizeGathering((await response.json()) as Gathering)
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

  function openGatheringEdit() {
    if (selectedGathering === null) return
    setEditHeldOn(selectedGathering.heldOn)
    setEditGatheringType(selectedGathering.gatheringType)
    setEditEndsOn(selectedGathering.endsOn ?? selectedGathering.heldOn)
    setEditHostMemberId(
      attendances.find(
        (attendance) =>
          attendance.gatheringId === selectedGathering.id &&
          attendance.participationType === 'HOST' &&
          attendance.attendanceStatus === 'RECORDED',
      )?.memberId ?? '',
    )
    setEditTitle(selectedGathering.title ?? '')
    setEditLocation(selectedGathering.location ?? '')
    setEditGatheringError('')
    setIsEditGatheringOpen(true)
  }

  async function updateGathering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedGathering === null) return
    setEditGatheringError('')
    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedGathering.id}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            heldOn: editHeldOn,
            gatheringType: editGatheringType,
            endsOn: editGatheringType === 'EVENT' ? editEndsOn : null,
            hostMemberId:
              editGatheringType === 'CLASS' && editHostMemberId !== ''
                ? editHostMemberId
                : null,
            title: editTitle || null,
            startsAt: null,
            location: editLocation || null,
          }),
        },
      )
      if (!response.ok) {
        throw await responseError(response, '정모 정보를 변경하지 못했습니다.')
      }
      const changed = normalizeGathering((await response.json()) as Gathering)
      setGatherings((previous) =>
        previous.map((gathering) =>
          gathering.id === changed.id ? changed : gathering,
        ),
      )
      await loadAttendances(selectedGathering.id)
      setIsEditGatheringOpen(false)
    } catch (error) {
      setEditGatheringError(
        errorMessage(error, '정모 정보를 변경하지 못했습니다.'),
      )
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
      const cancelled = normalizeGathering((await response.json()) as Gathering)
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

    const existingAttendance = selectedAttendances.find(
      (attendance) => attendance.memberId === memberId,
    )
    if (
      existingAttendance !== undefined &&
      !(await confirm({
        title: '출석 상태를 변경할까요?',
        message: '이미 리스트에 존재하는 회원입니다. 그래도 변경하시겠습니까?',
        confirmLabel: '변경',
      }))
    ) {
      return
    }

    const payload = { memberId, participationType: 'NORMAL' }
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
        throw await responseError(response, '출석 기록을 변경하지 못했습니다.')
      }
      const attendance = (await response.json()) as Attendance
      setAttendances((previous) => {
        const existingIndex = previous.findIndex(
          (item) => item.id === attendance.id,
        )
        if (existingIndex === -1) {
          return [...previous, attendance]
        }
        return previous.map((item) =>
          item.id === attendance.id ? attendance : item,
        )
      })
      setMemberId('')
      setMessage(
        existingAttendance
          ? '출석 상태를 변경했습니다.'
          : '출석 기록을 추가했습니다.',
      )
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
      setGatherings(
        ((await gatheringsResponse.json()) as Gathering[]).map(
          normalizeGathering,
        ),
      )
      setHasLoadedMemberHistory(true)
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
      const attendance = selectedAttendances.find(
        (item) => item.id === cancellingAttendanceId,
      )
      const endpoint =
        attendance?.participationType === 'COUPON'
          ? `/api/v1/coupons/usages/attendance/${cancellingAttendanceId}/reverse`
          : `/api/v1/gatherings/${selectedGathering.id}/attendances/${cancellingAttendanceId}/cancel`
      const cancellationPayload =
        attendance?.participationType === 'COUPON'
          ? { reason: cancellationReason.trim() }
          : { cancellationReason: cancellationReason.trim() }
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cancellationPayload),
      })
      if (!response.ok) {
        throw await responseError(response, '출석 기록을 취소하지 못했습니다.')
      }
      if (attendance?.participationType === 'COUPON') {
        await loadAttendances(selectedGathering.id)
        setCancellingAttendanceId(null)
        setCancellationReason('')
        setMessage('쿠폰 사용과 출석 기록을 취소했습니다.')
        return
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

  async function deleteAttendance(attendance: Attendance) {
    if (
      selectedGathering === null ||
      attendance.participationType === 'COUPON'
    ) {
      return
    }
    const member = members.find((item) => item.id === attendance.memberId)
    const confirmed = await confirm({
      title: '출석 기록을 삭제할까요?',
      message: `${member?.displayName ?? '이 회원'}의 출석 기록을 삭제하면 복구할 수 없습니다.`,
      confirmLabel: '삭제',
      isDestructive: true,
    })
    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedGathering.id}/attendances/${attendance.id}`,
        { method: 'DELETE', credentials: 'include' },
      )
      if (!response.ok) {
        throw await responseError(response, '출석 기록을 삭제하지 못했습니다.')
      }
      setAttendances((previous) =>
        previous.filter((item) => item.id !== attendance.id),
      )
      setCancellingAttendanceId((current) =>
        current === attendance.id ? null : current,
      )
      setMessage('출석 기록을 삭제했습니다.')
    } catch (error) {
      setMessage(errorMessage(error, '출석 기록을 삭제하지 못했습니다.'))
    }
  }

  const selectedAttendances = useMemo(
    () =>
      attendances
        .filter((attendance) => attendance.gatheringId === selectedGatheringId)
        .slice()
        .sort((left, right) => {
          const participationOrder =
            Number(right.participationType === 'HOST') -
            Number(left.participationType === 'HOST')
          if (participationOrder !== 0) return participationOrder

          const leftName = membersById.get(left.memberId)?.displayName ?? ''
          const rightName = membersById.get(right.memberId)?.displayName ?? ''
          return leftName.localeCompare(rightName, 'ko')
        }),
    [attendances, membersById, selectedGatheringId],
  )
  const selectedAttendanceCount = selectedAttendances.filter(
    (attendance) => attendance.attendanceStatus === 'RECORDED',
  ).length
  const visibleGatherings = gatherings.filter((gathering) => {
    const isInCalendarMonth =
      gathering.heldOn.slice(0, 7) ===
      `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}`
    const matchesStatus =
      gatheringFilter === 'ALL' || gathering.gatheringStatus === gatheringFilter
    return isInCalendarMonth && matchesStatus
  })

  function openMemberHistory() {
    setIsMemberHistoryOpen(true)
    setHistoryMemberId('')
    setHistoryAttendances([])
    setHasLoadedMemberHistory(false)
  }

  function selectHistoryMember(memberId: string) {
    setHistoryMemberId(memberId)
    setHistoryAttendances([])
    setHasLoadedMemberHistory(false)
  }

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
            정모 취소 이력
          </button>
          <button
            className="secondary-button"
            onClick={openMemberHistory}
            type="button"
          >
            회원별 출석 이력
          </button>
          <button
            aria-label="새로고침"
            className="secondary-button icon-button"
            onClick={() => void refreshGatherings()}
            type="button"
          >
            <RefreshIcon />
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
              날짜를 눌러 정모 개설 날짜를 선택하거나, 표시된 출석부를 바로
              엽니다.
            </p>
          </div>
        </div>
        <div className="calendar-navigation">
          <button
            aria-label="이전 달"
            className="calendar-navigation-button"
            onClick={() => moveCalendarMonth(-1)}
            type="button"
          >
            ‹
          </button>
          <div
            className="calendar-month-picker"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsMonthPickerOpen(false)
              }
            }}
          >
            <button
              aria-expanded={isMonthPickerOpen}
              aria-haspopup="dialog"
              className="calendar-month-trigger"
              onClick={() => setIsMonthPickerOpen((previous) => !previous)}
              type="button"
            >
              <span aria-live="polite">
                {calendarMonth.year}년 {calendarMonth.month + 1}월
              </span>
              <span aria-hidden="true">▾</span>
            </button>
            {isMonthPickerOpen && (
              <div
                aria-label="연월 선택"
                className="calendar-month-popover"
                role="dialog"
              >
                <div className="calendar-year-navigation">
                  <button
                    aria-label="이전 연도"
                    onClick={() =>
                      setCalendarMonth((previous) => ({
                        ...previous,
                        year: previous.year - 1,
                      }))
                    }
                    type="button"
                  >
                    ‹
                  </button>
                  <strong>{calendarMonth.year}년</strong>
                  <button
                    aria-label="다음 연도"
                    onClick={() =>
                      setCalendarMonth((previous) => ({
                        ...previous,
                        year: previous.year + 1,
                      }))
                    }
                    type="button"
                  >
                    ›
                  </button>
                </div>
                <div className="calendar-month-options">
                  {monthLabels.map((label, month) => (
                    <button
                      aria-pressed={calendarMonth.month === month}
                      className={
                        calendarMonth.month === month
                          ? 'is-selected'
                          : undefined
                      }
                      key={label}
                      onClick={() => selectCalendarMonth(month)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button
            aria-label="다음 달"
            className="calendar-navigation-button"
            onClick={() => moveCalendarMonth(1)}
            type="button"
          >
            ›
          </button>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {weekdayLabels.map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="calendar-grid">
          {calendarDays.map((calendarDay) => (
            <div
              className={`calendar-day ${heldOn === calendarDay.date ? 'calendar-day-selected' : ''} ${calendarDay.isOutsideMonth ? 'calendar-day-outside-month' : ''}`}
              key={calendarDay.date}
            >
              <button
                aria-label={`${formatCalendarDateLabel(calendarDay.year, calendarDay.month, calendarDay.day)} 선택`}
                aria-pressed={heldOn === calendarDay.date}
                className="calendar-day-select-target"
                disabled={readOnly}
                onClick={() => selectCalendarDate(calendarDay.date)}
                type="button"
              />
              <span aria-hidden="true" className="calendar-day-number">
                {calendarDay.day}
              </span>
              <div className="calendar-gatherings">
                {calendarDay.gatherings.map((gathering) => (
                  <button
                    className={`calendar-gathering gathering-type-${gathering.gatheringType.toLowerCase()} gathering-status-${gathering.gatheringStatus.toLowerCase()}`}
                    key={gathering.id}
                    onClick={() => void selectGathering(gathering)}
                    type="button"
                  >
                    {gathering.title ??
                      gatheringTypeLabels[gathering.gatheringType] ??
                      gatheringStatusLabels[gathering.gatheringStatus]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="attendance-grid">
        <section className="panel gathering-list-panel">
          <div className="panel-heading">
            <div>
              <h3>출석부 목록</h3>
              <p>선택한 달의 모임을 출석 상태별로 확인할 수 있습니다.</p>
            </div>
            <div
              className="gathering-filter-buttons"
              role="group"
              aria-label="출석부 상태 필터"
            >
              {(
                [
                  ['ALL', '전체'],
                  ['OPEN', '출석 진행 중'],
                  ['CLOSED', '마감'],
                ] as const
              ).map(([filter, label]) => (
                <button
                  aria-pressed={gatheringFilter === filter}
                  className={
                    gatheringFilter === filter
                      ? 'is-active'
                      : 'secondary-button'
                  }
                  key={filter}
                  onClick={() => setGatheringFilter(filter)}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visibleGatherings.length === 0 ? (
            <EmptyState
              description="선택한 달과 상태에 해당하는 출석부가 없습니다."
              icon="□"
              title="표시할 출석부가 없습니다"
            />
          ) : (
            <ul className="gathering-list">
              {visibleGatherings.map((gathering) => (
                <li key={gathering.id}>
                  <button
                    className={`gathering-row ${selectedGatheringId === gathering.id ? 'selected' : ''}`}
                    onClick={() => void selectGathering(gathering)}
                    type="button"
                  >
                    <span className="gathering-primary-column">
                      <strong>{gatheringPeriodLabel(gathering)}</strong>
                      {gathering.title && ` · ${gathering.title}`}
                    </span>
                    <span
                      className={`status gathering-type-column gathering-type-${gathering.gatheringType.toLowerCase()}`}
                    >
                      {gatheringTypeLabels[gathering.gatheringType]}
                    </span>
                    <span
                      className={`status gathering-status-column gathering-status-${gathering.gatheringStatus.toLowerCase()}`}
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
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsCreateGatheringOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                disabled={isCreatingGathering}
                form="create-gathering-form"
                type="submit"
              >
                {isCreatingGathering ? '정모 개설 중…' : '정모 개설'}
              </button>
            </>
          }
          onClose={() => setIsCreateGatheringOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="create-gathering-heading">정모 개설</h3>
            <p>모임 정보를 입력하면 초안 상태로 개설됩니다.</p>
          </div>
          <GatheringForm
            endsOn={endsOn}
            error={createGatheringError}
            formId="create-gathering-form"
            gatheringType={gatheringType}
            heldOn={heldOn}
            hostMemberId={hostMemberId}
            hostMembers={activeMembers}
            isSubmitting={isCreatingGathering}
            location={location}
            onCancel={() => setIsCreateGatheringOpen(false)}
            onEndsOnChange={setEndsOn}
            onGatheringTypeChange={(value) => {
              setGatheringType(value)
              if (value === 'EVENT') {
                setEndsOn(heldOn)
                setHostMemberId('')
              }
            }}
            onHostMemberIdChange={setHostMemberId}
            onHeldOnChange={setHeldOn}
            onLocationChange={setLocation}
            onSubmit={createGathering}
            onTitleChange={setTitle}
            submitLabel="정모 개설"
            submittingLabel="정모 개설 중…"
            showHostSelection
            showActions={false}
            title={title}
          />
        </Modal>
      )}

      {isMemberHistoryOpen && (
        <Modal
          ariaLabelledBy="member-history-heading"
          onClose={() => setIsMemberHistoryOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="member-history-heading">회원별 출석 이력</h3>
            <p>회원을 선택한 뒤 이력을 조회합니다.</p>
          </div>
          <div className="attendance-history-controls">
            <SearchableMemberSelect
              includeWithdrawn
              label="회원"
              members={members}
              onChange={selectHistoryMember}
              value={historyMemberId}
            />
            <button onClick={() => void loadMemberHistory()} type="button">
              이력 조회
            </button>
          </div>
          {hasLoadedMemberHistory && historyAttendances.length === 0 && (
            <EmptyState
              description="이 회원의 출석 기록이 생기면 여기에 표시됩니다."
              icon="✓"
              title="조회된 출석 이력이 없습니다"
            />
          )}
          {hasLoadedMemberHistory && historyAttendances.length > 0 && (
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
                        : `취소됨: ${attendance.cancellationReason ?? '사유 없음'}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Modal>
      )}

      {selectedGathering && (
        <Modal
          ariaLabelledBy="attendance-detail-heading"
          closeOnEscape={!isGatheringCancellationOpen && !isEditGatheringOpen}
          footer={
            !readOnly && selectedGathering.gatheringStatus !== 'CANCELLED' ? (
              <div className="form-actions">
                {selectedGathering.gatheringStatus === 'OPEN' && (
                  <button
                    onClick={() => void changeGatheringStatus('close')}
                    type="button"
                  >
                    출석 마감
                  </button>
                )}
                {selectedGathering.gatheringStatus === 'CLOSED' && (
                  <button
                    onClick={() => void changeGatheringStatus('reopen')}
                    type="button"
                  >
                    재개
                  </button>
                )}
                {selectedGathering.gatheringStatus !== 'CLOSED' && (
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
            ) : undefined
          }
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
                  {gatheringPeriodLabel(selectedGathering)}
                </h3>
                <p className="attendance-detail-title">
                  {selectedGathering.title ?? '정모'}
                </p>
                <p>
                  {selectedGathering.location ?? '장소 미입력'} ·{' '}
                  {gatheringTypeLabels[selectedGathering.gatheringType]} ·{' '}
                  {gatheringStatusLabels[selectedGathering.gatheringStatus]} ·{' '}
                  {selectedAttendanceCount}명 참여
                </p>
              </div>
              {!readOnly && (
                <div className="form-actions">
                  {selectedGathering.gatheringStatus !== 'CANCELLED' && (
                    <button
                      className="secondary-button"
                      onClick={openGatheringEdit}
                      type="button"
                    >
                      수정
                    </button>
                  )}
                  {selectedGathering.gatheringStatus === 'DRAFT' && (
                    <button
                      onClick={() => void changeGatheringStatus('open')}
                      type="button"
                    >
                      출석 시작
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
                <button type="submit">출석 기록</button>
              </form>
            )}

            {selectedAttendances.length === 0 ? (
              <EmptyState
                description="출석을 기록하면 회원별 참여 내역을 확인할 수 있습니다."
                icon="✓"
                title="기록된 출석이 없습니다"
              />
            ) : (
              <ul className="attendance-list">
                {selectedAttendances.map((attendance) => {
                  const member = membersById.get(attendance.memberId)
                  return (
                    <Fragment key={attendance.id}>
                      <li>
                        <strong>
                          {member?.displayName ?? '알 수 없는 회원'}
                        </strong>
                        {attendance.attendanceStatus === 'RECORDED' ? (
                          <span
                            className={`attendance-participation attendance-participation-${attendance.participationType.toLowerCase()}`}
                          >
                            {participationLabels[attendance.participationType]}
                          </span>
                        ) : (
                          <>
                            <span>
                              {`취소 사유: ${attendance.cancellationReason ?? '사유 없음'}`}
                            </span>
                            <span className="attendance-cancelled-label">
                              취소
                            </span>
                          </>
                        )}
                        {!readOnly &&
                          selectedGathering.gatheringStatus === 'OPEN' &&
                          attendance.attendanceStatus === 'RECORDED' && (
                            <span className="attendance-row-actions">
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
                              {attendance.participationType !== 'COUPON' && (
                                <button
                                  className="danger-button"
                                  onClick={() =>
                                    void deleteAttendance(attendance)
                                  }
                                  type="button"
                                >
                                  삭제
                                </button>
                              )}
                            </span>
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
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsGatheringCancellationOpen(false)}
                type="button"
              >
                돌아가기
              </button>
              <button
                className="danger-button"
                form="cancel-gathering-form"
                type="submit"
              >
                모임 취소
              </button>
            </>
          }
          onClose={() => setIsGatheringCancellationOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="cancel-gathering-heading">모임을 취소할까요?</h3>
            <p>{`${selectedGathering.heldOn} ${selectedGathering.title ?? '정모'}`}</p>
          </div>
          <form
            className="form"
            id="cancel-gathering-form"
            onSubmit={cancelGathering}
          >
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
            {gatheringCancellationError && (
              <p className="field-error" role="alert">
                {gatheringCancellationError}
              </p>
            )}
          </form>
        </Modal>
      )}
      {isEditGatheringOpen && selectedGathering && (
        <Modal
          ariaLabelledBy="edit-gathering-heading"
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsEditGatheringOpen(false)}
                type="button"
              >
                취소
              </button>
              <button form="edit-gathering-form" type="submit">
                변경사항 저장
              </button>
            </>
          }
          onClose={() => setIsEditGatheringOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="edit-gathering-heading">정모 정보 수정</h3>
            <p>구분, 날짜, 진행자, 제목, 장소를 변경할 수 있습니다.</p>
          </div>
          <GatheringForm
            endsOn={editEndsOn}
            error={editGatheringError}
            formId="edit-gathering-form"
            gatheringType={editGatheringType}
            heldOn={editHeldOn}
            hostMemberId={editHostMemberId}
            hostMembers={activeMembers}
            location={editLocation}
            onCancel={() => setIsEditGatheringOpen(false)}
            onEndsOnChange={setEditEndsOn}
            onGatheringTypeChange={(value) => {
              setEditGatheringType(value)
              if (value === 'EVENT') setEditEndsOn(editHeldOn)
            }}
            onHeldOnChange={setEditHeldOn}
            onHostMemberIdChange={setEditHostMemberId}
            onLocationChange={setEditLocation}
            onSubmit={updateGathering}
            onTitleChange={setEditTitle}
            submitLabel="변경사항 저장"
            showHostSelection
            showActions={false}
            title={editTitle}
          />
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
            <EmptyState
              description="취소된 정모와 사유가 생기면 이곳에 보관됩니다."
              icon="○"
              title="취소된 정모가 없습니다"
            />
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
    </section>
  )
}
