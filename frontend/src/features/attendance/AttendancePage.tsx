import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import type { Member } from '../../App'
import { GatheringForm } from './GatheringForm'
import { ClassSeriesBadge } from './ClassSeriesBadge'
import type { GatheringType } from './GatheringForm'
import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { useFeedbackDialog } from '../../shared/feedback-dialog/useFeedbackDialog'
import { FeedbackMessageDialog } from '../../shared/feedback-dialog/FeedbackMessageDialog'
import { SearchableMemberSelect } from '../../shared/member-select/SearchableMemberSelect'
import { EmptyState } from '../../shared/ui/EmptyState'
import { RefreshIcon } from '../../shared/ui/RefreshIcon'
import { Modal } from '../../shared/ui/Modal'
import { KoreanMonthInput } from '../../shared/ui/KoreanMonthInput'
import { KoreanDateInput } from '../../shared/ui/KoreanDateInput'
import { SelectField } from '../../shared/ui/SelectField'

type GatheringStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
type ParticipationType = 'NORMAL' | 'COUPON' | 'HOST'
type AttendanceStatus = 'RECORDED' | 'CANCELLED'
type PaymentStatus = 'PENDING' | 'PAID' | 'PREPAID' | 'EXEMPT'
type GatheringFilter = 'ALL' | 'OPEN' | 'CLOSED'
type AttendanceView = 'ATTENDANCE' | 'UNPAID'
type CalendarDropAction = 'MOVE' | 'COPY'
type ExpenseType = 'RENTAL' | 'OTHER'

type CalendarDrop = {
  gathering: Gathering
  targetDate: string
}

type Settlement = {
  month: string | null
  collectedAmount: number
  unpaidAmount: number
  expenseAmount: number
  netAmount: number
  items: SettlementExpense[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

type SettlementExpense = {
  id: string
  spentOn: string
  rentalMonth: string | null
  category: string
  description: string | null
  amount: number
}

type Gathering = {
  id: string
  heldOn: string
  gatheringType: GatheringType
  endsOn: string | null
  title: string | null
  startsAt: string | null
  location: string | null
  defaultParticipationFee: number
  classSeriesId: string | null
  gatheringStatus: GatheringStatus
  cancelledAt: string | null
  cancellationReason: string | null
}

type ClassSeriesEnrollment = {
  id: string
  classSeriesId: string
  memberId: string
  paidAmount: number
  paidOn: string
}

type ClassSeriesResponse = {
  id: string
  title: string
  startsOn: string
  sessionCount: number
  sessionFee: number
  totalFee: number
  gatherings: Gathering[]
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
  appliedFee: number
  paymentStatus: PaymentStatus
  paidAt: string | null
  feeOverridden: boolean
}

type CancelledGatheringPage = {
  items: Gathering[]
  page: number
  size: number
  totalElements: number
  totalPages: number
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
    defaultParticipationFee: gathering.defaultParticipationFee ?? 0,
    classSeriesId: gathering.classSeriesId ?? null,
    cancelledAt: gathering.cancelledAt ?? null,
    cancellationReason: gathering.cancellationReason ?? null,
  }
}

const participationLabels: Record<ParticipationType, string> = {
  NORMAL: '출석',
  COUPON: '쿠폰',
  HOST: '진행자',
}

const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: '미입금',
  PAID: '입금 완료',
  PREPAID: '선납 회원',
  EXEMPT: '면제',
}

function formatWon(amount: number | null | undefined) {
  const safeAmount =
    typeof amount === 'number' && Number.isFinite(amount) ? amount : 0
  return `${new Intl.NumberFormat('ko-KR').format(safeAmount)}원`
}

function rentalExpenseLabel(rentalMonth: string) {
  const [year, month] = rentalMonth.split('-')
  return `${year}년 ${Number(month)}월 대관비`
}

function normalizeMoneyInput(value: string) {
  return value.replace(/^0+(?=\d)/, '')
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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)
  return formatDate(value.getFullYear(), value.getMonth(), value.getDate())
}

function movedEndsOn(gathering: Gathering, targetDate: string) {
  if (gathering.gatheringType !== 'EVENT' || gathering.endsOn === null) {
    return null
  }
  const start = new Date(`${gathering.heldOn}T00:00:00`)
  const end = new Date(`${gathering.endsOn}T00:00:00`)
  const durationDays = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  )
  return addDays(targetDate, durationDays)
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
  const [defaultParticipationFee, setDefaultParticipationFee] = useState('0')
  const [isRecurringClass, setIsRecurringClass] = useState(false)
  const [recurringWeeks, setRecurringWeeks] = useState('3')
  const [isExistingClassConversionOpen, setIsExistingClassConversionOpen] = useState(false)
  const [conversionGatheringIds, setConversionGatheringIds] = useState<string[]>([])
  const [conversionAttendances, setConversionAttendances] = useState<Attendance[]>([])
  const [conversionPrepaidMemberIds, setConversionPrepaidMemberIds] = useState<string[]>([])
  const [conversionTitle, setConversionTitle] = useState('')
  const [conversionSessionFee, setConversionSessionFee] = useState('0')
  const [conversionError, setConversionError] = useState('')
  const [isConvertingExistingClasses, setIsConvertingExistingClasses] = useState(false)
  const [isCreateGatheringOpen, setIsCreateGatheringOpen] = useState(false)
  const [isEditGatheringOpen, setIsEditGatheringOpen] = useState(false)
  const [editHeldOn, setEditHeldOn] = useState(today)
  const [editGatheringType, setEditGatheringType] =
    useState<GatheringType>('CLASS')
  const [editEndsOn, setEditEndsOn] = useState(today)
  const [editHostMemberId, setEditHostMemberId] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editDefaultParticipationFee, setEditDefaultParticipationFee] =
    useState('0')
  const [editGatheringError, setEditGatheringError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date()
    return { year: current.getFullYear(), month: current.getMonth() }
  })
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [calendarDrop, setCalendarDrop] = useState<CalendarDrop | null>(null)
  const [draggingGatheringId, setDraggingGatheringId] = useState<string | null>(
    null,
  )
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [memberId, setMemberId] = useState('')
  const [historyMemberId, setHistoryMemberId] = useState('')
  const [historyAttendances, setHistoryAttendances] = useState<Attendance[]>([])
  const [hasLoadedMemberHistory, setHasLoadedMemberHistory] = useState(false)
  const [isMemberHistoryOpen, setIsMemberHistoryOpen] = useState(false)
  const [gatheringFilter, setGatheringFilter] =
    useState<GatheringFilter>('OPEN')
  const [attendanceView, setAttendanceView] =
    useState<AttendanceView>('ATTENDANCE')
  const [unpaidAttendances, setUnpaidAttendances] = useState<Attendance[]>([])
  const [settlementScope, setSettlementScope] = useState<'ALL' | 'MONTH'>(
    'MONTH',
  )
  const [settlementMonth, setSettlementMonth] = useState(today.slice(0, 7))
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const [isSettlementLoading, setIsSettlementLoading] = useState(false)
  const [settlementPage, setSettlementPage] = useState(0)
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false)
  const [expenseDate, setExpenseDate] = useState(today)
  const [expenseType, setExpenseType] = useState<ExpenseType>('RENTAL')
  const [expenseCategory, setExpenseCategory] = useState('기타 지출')
  const [expenseRentalMonth, setExpenseRentalMonth] = useState(
    today.slice(0, 7),
  )
  const [expenseDescription, setExpenseDescription] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('0')
  const [selectedPaymentAttendance, setSelectedPaymentAttendance] =
    useState<Attendance | null>(null)
  const [paymentFee, setPaymentFee] = useState('0')
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('PENDING')
  const [isPaymentFeeEditing, setIsPaymentFeeEditing] = useState(false)
  const [isClassSeriesEnrollmentOpen, setIsClassSeriesEnrollmentOpen] = useState(false)
  const [classSeriesEnrollments, setClassSeriesEnrollments] = useState<ClassSeriesEnrollment[]>([])
  const [prepaidMemberId, setPrepaidMemberId] = useState('')
  const [prepaidAmount, setPrepaidAmount] = useState('0')
  const [classSeriesTotalFee, setClassSeriesTotalFee] = useState(0)
  const [classSeriesEnrollmentError, setClassSeriesEnrollmentError] = useState('')
  const [isSavingClassSeriesEnrollment, setIsSavingClassSeriesEnrollment] = useState(false)
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
  const longPressTimerRef = useRef<number | null>(null)
  const longPressedGatheringIdRef = useRef<string | null>(null)

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
  const eligibleExistingClasses = useMemo(
    () =>
      gatherings
        .filter(
          (gathering) =>
            gathering.gatheringType === 'CLASS' &&
            (gathering.gatheringStatus === 'DRAFT' ||
              gathering.gatheringStatus === 'OPEN') &&
            gathering.classSeriesId === null,
        )
        .toSorted((left, right) => left.heldOn.localeCompare(right.heldOn)),
    [gatherings],
  )
  const conversionMembers = useMemo(() => {
    const ids = new Set(
      conversionAttendances
        .filter(
          (attendance) =>
            attendance.attendanceStatus === 'RECORDED' &&
            attendance.participationType === 'NORMAL',
        )
        .map((attendance) => attendance.memberId),
    )
    return members.filter((member) => ids.has(member.id))
  }, [conversionAttendances, members])
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

  useEffect(() => {
    if (calendarDrop === null) {
      return
    }

    function closeCalendarDrop(event: PointerEvent) {
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('.calendar-drop-actions') !== null
      ) {
        return
      }
      setCalendarDrop(null)
    }

    document.addEventListener('pointerdown', closeCalendarDrop, true)
    return () => document.removeEventListener('pointerdown', closeCalendarDrop, true)
  }, [calendarDrop])

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
    } catch (error) {
      setMessage(errorMessage(error, '출석부 목록을 불러오지 못했습니다.'))
    }
  }

  async function loadSettlement(page = settlementPage) {
    setIsSettlementLoading(true)
    const queryParams = new URLSearchParams({ page: String(page), size: '20' })
    if (settlementScope === 'MONTH') queryParams.set('month', settlementMonth)
    try {
      const [settlementResponse, unpaidResponse] = await Promise.all([
        fetch(`/api/v1/settlements?${queryParams.toString()}`, {
          credentials: 'include',
        }),
        fetch('/api/v1/gatherings/unpaid-attendances', {
          credentials: 'include',
        }),
      ])
      if (!settlementResponse.ok) {
        throw await responseError(
          settlementResponse,
          '정산 현황을 불러오지 못했습니다.',
        )
      }
      if (!unpaidResponse.ok) {
        throw await responseError(
          unpaidResponse,
          '미입금 현황을 불러오지 못했습니다.',
        )
      }
      setSettlement((await settlementResponse.json()) as Settlement)
      setSettlementPage(page)
      setUnpaidAttendances((await unpaidResponse.json()) as Attendance[])
    } catch (error) {
      setMessage(errorMessage(error, '정산 현황을 불러오지 못했습니다.'))
    } finally {
      setIsSettlementLoading(false)
    }
  }

  async function createExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(expenseAmount)
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage('지출 금액은 1원 이상의 정수로 입력해 주세요.')
      return
    }
    if (expenseType === 'OTHER' && expenseCategory.trim().length === 0) {
      setMessage('지출 분류를 입력해 주세요.')
      return
    }
    if (expenseType === 'RENTAL' && !/^\d{4}-\d{2}$/.test(expenseRentalMonth)) {
      setMessage('대관 적용 월을 선택해 주세요.')
      return
    }
    try {
      const response = await fetch('/api/v1/settlements/expenses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spentOn: expenseDate,
          category: expenseType === 'RENTAL' ? '대관비' : expenseCategory,
          rentalMonth:
            expenseType === 'RENTAL' ? expenseRentalMonth : null,
          description: expenseDescription || null,
          amount,
        }),
      })
      if (!response.ok) {
        throw await responseError(response, '지출 내역을 저장하지 못했습니다.')
      }
      setIsExpenseFormOpen(false)
      setExpenseDescription('')
      setExpenseAmount('0')
      await loadSettlement(0)
      setMessage('지출 내역을 저장했습니다.')
    } catch (error) {
      setMessage(errorMessage(error, '지출 내역을 저장하지 못했습니다.'))
    }
  }

  function openPaymentEditor(attendance: Attendance) {
    setSelectedPaymentAttendance(attendance)
    setPaymentFee(String(attendance.appliedFee))
    setPaymentStatus(attendance.paymentStatus)
    setIsPaymentFeeEditing(false)
  }

  function selectPaymentStatus(status: PaymentStatus) {
    setPaymentStatus(status)
    if (status === 'EXEMPT') {
      setPaymentFee('0')
      setIsPaymentFeeEditing(false)
      return
    }
    if (status === 'PAID' && selectedPaymentAttendance !== null) {
      const defaultFee = gatherings.find(
        (gathering) => gathering.id === selectedPaymentAttendance.gatheringId,
      )?.defaultParticipationFee
      if (defaultFee !== undefined) {
        setPaymentFee(String(defaultFee))
        setIsPaymentFeeEditing(false)
      }
    }
  }

  async function saveAttendancePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedPaymentAttendance === null) return
    const appliedFee = Number(paymentFee)
    if (!Number.isInteger(appliedFee) || appliedFee < 0) {
      setMessage('적용 참가비는 0원 이상의 정수로 입력해 주세요.')
      return
    }
    if (appliedFee > 0 && paymentStatus === 'EXEMPT') {
      setMessage('면제인 경우 참가비를 0원으로 입력해 주세요.')
      return
    }
    if (appliedFee === 0 && paymentStatus === 'PAID') {
      setMessage('0원 참가비는 입금 완료로 처리할 수 없습니다.')
      return
    }
    try {
      const response = await fetch(
        `/api/v1/gatherings/${selectedPaymentAttendance.gatheringId}/attendances/${selectedPaymentAttendance.id}/payment`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appliedFee, paymentStatus }),
        },
      )
      if (!response.ok) {
        throw await responseError(response, '입금 정보를 변경하지 못했습니다.')
      }
      const changed = (await response.json()) as Attendance
      setAttendances((previous) =>
        previous.map((attendance) =>
          attendance.id === changed.id ? changed : attendance,
        ),
      )
      setUnpaidAttendances((previous) =>
        paymentStatus === 'PENDING'
          ? previous.map((attendance) =>
              attendance.id === changed.id ? changed : attendance,
            )
          : previous.filter((attendance) => attendance.id !== changed.id),
      )
      if (attendanceView === 'UNPAID') {
        await loadSettlement()
      }
      setSelectedPaymentAttendance(null)
      setMessage('입금 정보를 저장했습니다.')
    } catch (error) {
      setMessage(errorMessage(error, '입금 정보를 변경하지 못했습니다.'))
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

  function openExistingClassConversion(initialGathering?: Gathering) {
    const initialIds = initialGathering ? [initialGathering.id] : []
    setConversionGatheringIds(initialIds)
    setConversionAttendances([])
    setConversionPrepaidMemberIds([])
    setConversionTitle(initialGathering?.title ?? '')
    setConversionSessionFee(String(initialGathering?.defaultParticipationFee ?? 0))
    setConversionError('')
    setIsExistingClassConversionOpen(true)
    if (!initialGathering) {
      return
    }
    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/gatherings/${initialGathering.id}/attendances`,
          { credentials: 'include' },
        )
        if (!response.ok) {
          throw await responseError(response, '기존 출석 기록을 불러오지 못했습니다.')
        }
        setConversionAttendances((await response.json()) as Attendance[])
      } catch (error) {
        setConversionError(errorMessage(error, '기존 출석 기록을 불러오지 못했습니다.'))
      }
    })()
  }

  async function toggleConversionGathering(gathering: Gathering) {
    const nextIds = conversionGatheringIds.includes(gathering.id)
      ? conversionGatheringIds.filter((id) => id !== gathering.id)
      : [...conversionGatheringIds, gathering.id]
    setConversionGatheringIds(nextIds)
    setConversionPrepaidMemberIds([])
    if (nextIds.length === 1) {
      setConversionTitle(gathering.title ?? '')
      setConversionSessionFee(String(gathering.defaultParticipationFee))
    }
    if (nextIds.length === 0) {
      setConversionAttendances([])
      return
    }
    try {
      const responses = await Promise.all(
        nextIds.map((id) =>
          fetch(`/api/v1/gatherings/${id}/attendances`, {
            credentials: 'include',
          }),
        ),
      )
      const failed = responses.find((response) => !response.ok)
      if (failed) {
        throw await responseError(failed, '기존 출석 기록을 불러오지 못했습니다.')
      }
      const loaded = await Promise.all(
        responses.map((response) => response.json() as Promise<Attendance[]>),
      )
      setConversionAttendances(loaded.flat())
    } catch (error) {
      setConversionError(errorMessage(error, '기존 출석 기록을 불러오지 못했습니다.'))
    }
  }

  async function convertExistingClasses(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const sessionFee = Number(conversionSessionFee)
    if (conversionGatheringIds.length < 2) {
      setConversionError('묶을 기존 수업을 두 개 이상 선택해 주세요.')
      return
    }
    if (conversionTitle.trim() === '') {
      setConversionError('연속 수업 이름을 입력해 주세요.')
      return
    }
    if (!Number.isInteger(sessionFee) || sessionFee < 0) {
      setConversionError('회당 참가비는 0원 이상의 정수로 입력해 주세요.')
      return
    }
    setIsConvertingExistingClasses(true)
    setConversionError('')
    try {
      const response = await fetch('/api/v1/class-series/convert-existing', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gatheringIds: conversionGatheringIds,
          title: conversionTitle,
          sessionFee,
          prepaidMemberIds: conversionPrepaidMemberIds,
        }),
      })
      if (!response.ok) {
        throw await responseError(response, '기존 수업을 연속 수업으로 묶지 못했습니다.')
      }
      const converted = (await response.json()) as ClassSeriesResponse
      const convertedById = new Map(
        converted.gatherings.map((gathering) => [gathering.id, normalizeGathering(gathering)]),
      )
      setGatherings((previous) =>
        previous.map((gathering) => convertedById.get(gathering.id) ?? gathering),
      )
      setAttendances((previous) =>
        previous.map((attendance) =>
          conversionGatheringIds.includes(attendance.gatheringId) &&
          conversionPrepaidMemberIds.includes(attendance.memberId) &&
          attendance.participationType === 'NORMAL'
            ? { ...attendance, appliedFee: 0, paymentStatus: 'PREPAID', feeOverridden: false }
            : attendance,
        ),
      )
      setIsExistingClassConversionOpen(false)
      window.setTimeout(
        () => setMessage('선택한 수업을 연속 수업으로 묶었습니다.'),
        0,
      )
    } catch (error) {
      setConversionError(errorMessage(error, '기존 수업을 연속 수업으로 묶지 못했습니다.'))
    } finally {
      setIsConvertingExistingClasses(false)
    }
  }

  async function openClassSeriesEnrollment() {
    if (selectedGathering === null || selectedGathering.classSeriesId === null) {
      return
    }
    setClassSeriesEnrollmentError('')
    setPrepaidMemberId('')
    try {
      const [seriesResponse, enrollmentsResponse] = await Promise.all([
        fetch(`/api/v1/class-series/${selectedGathering.classSeriesId}`, {
          credentials: 'include',
        }),
        fetch(`/api/v1/class-series/${selectedGathering.classSeriesId}/enrollments`, {
          credentials: 'include',
        }),
      ])
      if (!seriesResponse.ok || !enrollmentsResponse.ok) {
        throw await responseError(
          !seriesResponse.ok ? seriesResponse : enrollmentsResponse,
          '선납 회원 목록을 불러오지 못했습니다.',
        )
      }
      const series = (await seriesResponse.json()) as ClassSeriesResponse
      setClassSeriesTotalFee(series.totalFee)
      setPrepaidAmount(String(series.totalFee))
      setClassSeriesEnrollments((await enrollmentsResponse.json()) as ClassSeriesEnrollment[])
      setIsClassSeriesEnrollmentOpen(true)
    } catch (error) {
      setMessage(errorMessage(error, '선납 회원 목록을 불러오지 못했습니다.'))
    }
  }

  async function saveClassSeriesEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedGathering === null || selectedGathering.classSeriesId === null) {
      return
    }
    const paidAmount = Number(prepaidAmount)
    if (prepaidMemberId === '') {
      setClassSeriesEnrollmentError('선납 회원을 선택해 주세요.')
      return
    }
    if (!Number.isInteger(paidAmount) || paidAmount < 0) {
      setClassSeriesEnrollmentError('선납 금액은 0원 이상의 정수로 입력해 주세요.')
      return
    }
    setIsSavingClassSeriesEnrollment(true)
    setClassSeriesEnrollmentError('')
    try {
      const response = await fetch(
        `/api/v1/class-series/${selectedGathering.classSeriesId}/enrollments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: prepaidMemberId, paidAmount }),
        },
      )
      if (!response.ok) {
        throw await responseError(response, '선납 회원을 등록하지 못했습니다.')
      }
      const enrollment = (await response.json()) as ClassSeriesEnrollment
      setClassSeriesEnrollments((previous) => [...previous, enrollment])
      setPrepaidMemberId('')
      setPrepaidAmount(String(classSeriesTotalFee))
    } catch (error) {
      setClassSeriesEnrollmentError(errorMessage(error, '선납 회원을 등록하지 못했습니다.'))
    } finally {
      setIsSavingClassSeriesEnrollment(false)
    }
  }

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }

  function calendarDateAtPoint(clientX: number, clientY: number) {
    const element = document.elementFromPoint(clientX, clientY)
    return element?.closest<HTMLElement>('[data-calendar-date]')?.dataset
      .calendarDate
  }

  function openCalendarDropMenu(gathering: Gathering, targetDate: string) {
    if (gathering.heldOn === targetDate) {
      return
    }
    setCalendarDrop({ gathering, targetDate })
  }

  async function hostMemberIdFor(gathering: Gathering) {
    if (gathering.gatheringType !== 'CLASS') {
      return null
    }
    const response = await fetch(
      `/api/v1/gatherings/${gathering.id}/attendances`,
      { credentials: 'include' },
    )
    if (!response.ok) {
      throw await responseError(response, '진행자 정보를 불러오지 못했습니다.')
    }
    const gatheringAttendances = (await response.json()) as Attendance[]
    return (
      gatheringAttendances.find(
        (attendance) =>
          attendance.participationType === 'HOST' &&
          attendance.attendanceStatus === 'RECORDED',
      )?.memberId ?? null
    )
  }

  async function applyCalendarDropAction(action: CalendarDropAction) {
    if (calendarDrop === null) {
      return
    }
    const { gathering, targetDate } = calendarDrop
    setCalendarDrop(null)

    try {
      const hostMemberId = await hostMemberIdFor(gathering)
      const payload = {
        heldOn: targetDate,
        gatheringType: gathering.gatheringType,
        endsOn: movedEndsOn(gathering, targetDate),
        hostMemberId,
        title: gathering.title,
        startsAt: gathering.startsAt,
        location: gathering.location,
        defaultParticipationFee: gathering.defaultParticipationFee,
      }
      const response = await fetch(
        action === 'MOVE'
          ? `/api/v1/gatherings/${gathering.id}`
          : '/api/v1/gatherings',
        {
          method: action === 'MOVE' ? 'PUT' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        throw await responseError(
          response,
          action === 'MOVE'
            ? '모임 날짜를 변경하지 못했습니다.'
            : '모임을 복사하지 못했습니다.',
        )
      }
      const changed = normalizeGathering((await response.json()) as Gathering)
      setGatherings((previous) =>
        action === 'MOVE'
          ? previous.map((item) => (item.id === changed.id ? changed : item))
          : [changed, ...previous],
      )
    } catch (error) {
      setMessage(
        errorMessage(
          error,
          action === 'MOVE'
            ? '모임 날짜를 변경하지 못했습니다.'
            : '모임을 복사하지 못했습니다.',
        ),
      )
    }
  }

  async function createGathering(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setCreateGatheringError('')
    if (isRecurringClass && title.trim() === '') {
      setCreateGatheringError('연속 수업 이름을 입력해 주세요.')
      return
    }
    if (
      isRecurringClass &&
      (!Number.isInteger(Number(recurringWeeks)) ||
        Number(recurringWeeks) < 2 ||
        Number(recurringWeeks) > 24)
    ) {
      setCreateGatheringError('수업 횟수는 2회부터 24회까지 입력해 주세요.')
      return
    }
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
      defaultParticipationFee: Number(defaultParticipationFee),
    }

    try {
      const response = await fetch(isRecurringClass ? '/api/v1/class-series' : '/api/v1/gatherings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isRecurringClass
            ? {
                startsOn: heldOn,
                hostMemberId: hostMemberId || null,
                title,
                location: location || null,
                sessionFee: Number(defaultParticipationFee),
                sessionCount: Number(recurringWeeks),
              }
            : payload,
        ),
      })
      if (!response.ok) {
        throw await responseError(response, '출석부를 만들지 못했습니다.')
      }
      const created = (await response.json()) as Gathering | ClassSeriesResponse
      const createdGatherings = isRecurringClass
        ? (created as ClassSeriesResponse).gatherings.map(normalizeGathering)
        : [normalizeGathering(created as Gathering)]
      const gathering = createdGatherings[0]
      setGatherings((previous) => [...createdGatherings, ...previous])
      setSelectedGatheringId(gathering.id)
      // A selected host is saved as an attendance record, not on Gathering itself.
      // Load it immediately so the newly opened attendance sheet reflects the saved host.
      await loadAttendances(gathering.id)
      setIsCreateGatheringOpen(false)
      setTitle('')
      setLocation('')
      setGatheringType('CLASS')
      setEndsOn(heldOn)
      setHostMemberId('')
      setDefaultParticipationFee('0')
      setIsRecurringClass(false)
      setRecurringWeeks('3')
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
    setEditDefaultParticipationFee(
      String(selectedGathering.defaultParticipationFee),
    )
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
            defaultParticipationFee: Number(editDefaultParticipationFee),
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
    if (existingAttendance !== undefined) {
      setMessage('이미 출석부에 추가된 회원입니다.')
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
    } catch (error) {
      setMessage(errorMessage(error, '회원 출석 이력을 불러오지 못했습니다.'))
    }
  }

  async function cancelAttendance(attendance: Attendance) {
    if (selectedGathering === null || attendance.participationType === 'HOST') {
      return
    }

    const member = members.find((item) => item.id === attendance.memberId)
    const confirmed = await confirm({
      title: '출석을 취소할까요?',
      message:
        attendance.participationType === 'COUPON'
          ? `${member?.displayName ?? '이 회원'}의 출석을 취소하고 쿠폰 사용을 되돌립니다.`
          : `${member?.displayName ?? '이 회원'}의 출석 기록을 삭제합니다. 삭제한 기록은 복구할 수 없습니다.`,
      confirmLabel: '출석 취소',
      isDestructive: true,
    })
    if (!confirmed) {
      return
    }

    try {
      const endpoint =
        attendance.participationType === 'COUPON'
          ? `/api/v1/coupons/usages/attendance/${attendance.id}/reverse`
          : `/api/v1/gatherings/${selectedGathering.id}/attendances/${attendance.id}`
      const cancellationPayload =
        attendance.participationType === 'COUPON'
          ? { reason: '출석 취소' }
          : undefined
      const response = await fetch(endpoint, {
        method: attendance.participationType === 'COUPON' ? 'POST' : 'DELETE',
        credentials: 'include',
        ...(cancellationPayload
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(cancellationPayload),
            }
          : {}),
      })
      if (!response.ok) {
        throw await responseError(response, '출석을 취소하지 못했습니다.')
      }
      setAttendances((previous) =>
        previous.filter((item) => item.id !== attendance.id),
      )
      setHistoryAttendances((previous) =>
        previous.filter((item) => item.id !== attendance.id),
      )
      setMessage(
        attendance.participationType === 'COUPON'
          ? '출석을 취소하고 쿠폰 사용을 되돌렸습니다.'
          : '출석을 취소했습니다.',
      )
    } catch (error) {
      setMessage(errorMessage(error, '출석을 취소하지 못했습니다.'))
    }
  }

  const selectedAttendances = useMemo(
    () =>
      attendances
        .filter(
          (attendance) =>
            attendance.gatheringId === selectedGatheringId &&
            attendance.attendanceStatus === 'RECORDED',
        )
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
  const selectedAttendanceCount = selectedAttendances.length
  const selectedHostMemberId = selectedAttendances.find(
    (attendance) =>
      attendance.participationType === 'HOST' &&
      attendance.attendanceStatus === 'RECORDED',
  )?.memberId
  const selectedHost =
    selectedHostMemberId === undefined
      ? null
      : (membersById.get(selectedHostMemberId)?.displayName ?? '이름 미확인')
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
            className={
              attendanceView === 'UNPAID' ? undefined : 'secondary-button'
            }
            onClick={() => {
              setAttendanceView('UNPAID')
              void loadSettlement()
            }}
            type="button"
          >
            정산 관리
          </button>
          {attendanceView === 'UNPAID' && (
            <button
              className="secondary-button"
              onClick={() => setAttendanceView('ATTENDANCE')}
              type="button"
            >
              출석부로
            </button>
          )}
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

      {attendanceView === 'ATTENDANCE' && (
        <>
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
                  data-calendar-date={calendarDay.date}
                  onDragOver={(event) => {
                    if (!readOnly) {
                      event.preventDefault()
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const gatheringId = event.dataTransfer.getData(
                      'application/x-moing-gathering',
                    )
                    const gathering = gatherings.find(
                      (item) => item.id === gatheringId,
                    )
                    if (gathering !== undefined) {
                      openCalendarDropMenu(gathering, calendarDay.date)
                    }
                    setDraggingGatheringId(null)
                  }}
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
                        className={`calendar-gathering gathering-type-${gathering.gatheringType.toLowerCase()} gathering-status-${gathering.gatheringStatus.toLowerCase()} ${gathering.classSeriesId !== null ? 'is-class-series' : ''} ${draggingGatheringId === gathering.id ? 'is-dragging' : ''}`}
                        draggable={!readOnly}
                        key={gathering.id}
                        onClick={() => {
                          if (
                            longPressedGatheringIdRef.current === gathering.id
                          ) {
                            longPressedGatheringIdRef.current = null
                            return
                          }
                          void selectGathering(gathering)
                        }}
                        onDragEnd={() => setDraggingGatheringId(null)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'copyMove'
                          event.dataTransfer.setData(
                            'application/x-moing-gathering',
                            gathering.id,
                          )
                          setDraggingGatheringId(gathering.id)
                        }}
                        onPointerCancel={() => {
                          clearLongPressTimer()
                          setDraggingGatheringId(null)
                        }}
                        onPointerDown={(event) => {
                          if (readOnly) {
                            return
                          }
                          clearLongPressTimer()
                          const target = event.currentTarget
                          const pointerId = event.pointerId
                          longPressTimerRef.current = window.setTimeout(() => {
                            longPressedGatheringIdRef.current = gathering.id
                            setDraggingGatheringId(gathering.id)
                            target.setPointerCapture(pointerId)
                          }, 350)
                        }}
                        onPointerMove={(event) => {
                          if (draggingGatheringId !== gathering.id) {
                            return
                          }
                          event.preventDefault()
                        }}
                        onPointerUp={(event) => {
                          clearLongPressTimer()
                          if (draggingGatheringId !== gathering.id) {
                            return
                          }
                          const targetDate = calendarDateAtPoint(
                            event.clientX,
                            event.clientY,
                          )
                          if (targetDate !== undefined) {
                            openCalendarDropMenu(gathering, targetDate)
                          }
                          setDraggingGatheringId(null)
                        }}
                        type="button"
                      >
                        {gathering.classSeriesId !== null && (
                          <ClassSeriesBadge compact />
                        )}{' '}
                        {gathering.title ??
                          gatheringTypeLabels[gathering.gatheringType] ??
                          gatheringStatusLabels[gathering.gatheringStatus]}
                      </button>
                    ))}
                  </div>
                  {calendarDrop?.targetDate === calendarDay.date && (
                    <div className="calendar-drop-actions">
                      <button
                        onClick={() => void applyCalendarDropAction('MOVE')}
                        type="button"
                      >
                        이동
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => void applyCalendarDropAction('COPY')}
                        type="button"
                      >
                        복사
                      </button>
                    </div>
                  )}
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
                          {gathering.classSeriesId !== null && (
                            <ClassSeriesBadge />
                          )}
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
        </>
      )}

      {attendanceView === 'UNPAID' && (
        <section
          className="panel unpaid-attendance-panel"
          aria-labelledby="unpaid-attendance-heading"
        >
          <div className="panel-heading">
            <div>
              <h3 id="unpaid-attendance-heading">정산 관리</h3>
              <p>
                참가비 수입과 연습실 대관 같은 지출을 같은 기준으로 확인합니다.
              </p>
            </div>
            <div className="header-actions">
              {!readOnly && (
                <button
                  onClick={() => setIsExpenseFormOpen(true)}
                  type="button"
                >
                  지출 입력
                </button>
              )}
              <button
                aria-label="정산 관리 새로고침"
                className="secondary-button icon-button"
                onClick={() => void loadSettlement()}
                type="button"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
          <div
            className="settlement-filter"
            role="group"
            aria-label="정산 조회 범위"
          >
            <button
              aria-pressed={settlementScope === 'ALL'}
              className={
                settlementScope === 'ALL' ? 'is-active' : 'secondary-button'
              }
              onClick={() => {
                setSettlementScope('ALL')
                setSettlementPage(0)
              }}
              type="button"
            >
              전체
            </button>
            <button
              aria-pressed={settlementScope === 'MONTH'}
              className={
                settlementScope === 'MONTH' ? 'is-active' : 'secondary-button'
              }
              onClick={() => {
                setSettlementScope('MONTH')
                setSettlementPage(0)
              }}
              type="button"
            >
              월별
            </button>
            {settlementScope === 'MONTH' && (
              <KoreanMonthInput
                onChange={(value) => {
                  setSettlementMonth(value)
                  setSettlementPage(0)
                }}
                required
                value={settlementMonth}
              />
            )}
            <button onClick={() => void loadSettlement()} type="button">
              조회
            </button>
          </div>
          {isSettlementLoading ? (
            <p className="empty-state">정산 현황을 불러오는 중입니다.</p>
          ) : settlement === null ? (
            <EmptyState
              description="전체 또는 월별 범위를 선택한 뒤 조회해 주세요."
              icon="₩"
              title="정산 현황을 조회해 주세요"
            />
          ) : (
            <>
              <div className="statistics-grid settlement-summary-grid">
                <article>
                  <strong>입금 완료</strong>
                  <b>{formatWon(settlement.collectedAmount)}</b>
                  <span>참가비 수입</span>
                </article>
                <article>
                  <strong>미입금</strong>
                  <b>{formatWon(settlement.unpaidAmount)}</b>
                  <span>입금 대기 참가비</span>
                </article>
                <article>
                  <strong>지출</strong>
                  <b>{formatWon(settlement.expenseAmount)}</b>
                  <span>대관비 등 지출</span>
                </article>
                <article>
                  <strong>순수입</strong>
                  <b>{formatWon(settlement.netAmount)}</b>
                  <span>수입 - 지출</span>
                </article>
              </div>
              <section className="subsection">
                <h3>미입금 현황</h3>
                {unpaidAttendances.filter((attendance) => {
                  if (settlementScope === 'ALL') return true
                  return (
                    gatherings
                      .find(
                        (gathering) => gathering.id === attendance.gatheringId,
                      )
                      ?.heldOn.slice(0, 7) === settlementMonth
                  )
                }).length === 0 ? (
                  <p>미입금 내역이 없습니다.</p>
                ) : (
                  <ul className="unpaid-attendance-list">
                    {unpaidAttendances
                      .filter((attendance) => {
                        if (settlementScope === 'ALL') return true
                        return (
                          gatherings
                            .find(
                              (gathering) =>
                                gathering.id === attendance.gatheringId,
                            )
                            ?.heldOn.slice(0, 7) === settlementMonth
                        )
                      })
                      .map((attendance) => {
                        const gathering = gatherings.find(
                          (item) => item.id === attendance.gatheringId,
                        )
                        const member = membersById.get(attendance.memberId)
                        return (
                          <li key={attendance.id}>
                            <div className="unpaid-attendance-grid">
                              <div>
                                <strong>
                                  {member?.displayName ?? '알 수 없는 회원'}
                                </strong>
                                <span>
                                  {gathering
                                    ? `${gatheringPeriodLabel(gathering)} · ${gathering.title ?? '정모'}`
                                    : '정모 정보 없음'}
                                </span>
                              </div>
                              <span className="payment-fee">
                                {formatWon(attendance.appliedFee)}
                              </span>
                              <button
                                onClick={() => openPaymentEditor(attendance)}
                                type="button"
                              >
                                입금 처리
                              </button>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                )}
              </section>
              <section className="subsection">
                <h3>지출 내역</h3>
                {settlement.items.length === 0 ? (
                  <p>등록된 지출 내역이 없습니다.</p>
                ) : (
                  <ul className="settlement-expense-list">
                    {settlement.items.map((expense) => (
                      <li key={expense.id}>
                        <span>{expense.spentOn}</span>
                        <strong>
                          {expense.rentalMonth
                            ? rentalExpenseLabel(expense.rentalMonth)
                            : expense.category}
                        </strong>
                        <span>{expense.description}</span>
                        <b>{formatWon(expense.amount)}</b>
                      </li>
                    ))}
                  </ul>
                )}
                {settlement.totalPages > 1 && (
                  <div className="pagination-controls">
                    <button
                      className="secondary-button"
                      disabled={settlement.page === 0}
                      onClick={() => void loadSettlement(settlement.page - 1)}
                      type="button"
                    >
                      이전
                    </button>
                    <span>
                      {settlement.page + 1} / {settlement.totalPages}
                    </span>
                    <button
                      className="secondary-button"
                      disabled={settlement.page + 1 >= settlement.totalPages}
                      onClick={() => void loadSettlement(settlement.page + 1)}
                      type="button"
                    >
                      다음
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      )}

      {isExistingClassConversionOpen && (
        <Modal
          ariaLabelledBy="convert-existing-class-series-heading"
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsExistingClassConversionOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                disabled={isConvertingExistingClasses}
                form="convert-existing-class-series-form"
                type="submit"
              >
                {isConvertingExistingClasses ? '묶는 중…' : '연속 수업으로 묶기'}
              </button>
            </>
          }
          onClose={() => setIsExistingClassConversionOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="convert-existing-class-series-heading">수업 묶기</h3>
            <p>
              선택한 수업과 기존 출석 기록은 보존합니다. 선납 회원으로 선택한 참석자만 기존 출석과 이후 출석이 선납 회원으로 표시됩니다.
            </p>
          </div>
          <form
            className="form existing-class-conversion-form"
            id="convert-existing-class-series-form"
            onSubmit={convertExistingClasses}
          >
            <fieldset className="existing-class-selection">
              <legend>묶을 수업 선택</legend>
              {eligibleExistingClasses.length === 0 ? (
                <p className="empty-copy">묶을 수 있는 기존 수업이 없습니다.</p>
              ) : (
                <div className="existing-class-options">
                  {eligibleExistingClasses.map((gathering) => (
                    <label key={gathering.id}>
                      <input
                        checked={conversionGatheringIds.includes(gathering.id)}
                        onChange={() => void toggleConversionGathering(gathering)}
                        type="checkbox"
                      />
                      <span>
                        {gathering.heldOn} · {gathering.title ?? '제목 없는 수업'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <label>
              연속 수업 이름
              <input
                onChange={(event) => setConversionTitle(event.target.value)}
                required
                value={conversionTitle}
              />
            </label>
            <label>
              회당 참가비
              <input
                min="0"
                onChange={(event) =>
                  setConversionSessionFee(normalizeMoneyInput(event.target.value))
                }
                required
                step="1000"
                type="number"
                value={conversionSessionFee}
              />
            </label>
            <fieldset className="existing-class-selection">
              <legend>기존 참석자 중 선납 회원 선택</legend>
              <p className="field-hint">
                선택한 회원의 이미 기록된 일반 출석도 선납 회원으로 전환됩니다. 선택하지 않은 회원의 기존 입금 상태는 유지됩니다.
              </p>
              {conversionMembers.length === 0 ? (
                <p className="empty-copy">선택한 수업에 일반 출석 기록이 없습니다.</p>
              ) : (
                <div className="existing-class-options">
                  {conversionMembers.map((member) => (
                    <label key={member.id}>
                      <input
                        checked={conversionPrepaidMemberIds.includes(member.id)}
                        onChange={(event) =>
                          setConversionPrepaidMemberIds((previous) =>
                            event.target.checked
                              ? [...previous, member.id]
                              : previous.filter((id) => id !== member.id),
                          )
                        }
                        type="checkbox"
                      />
                      <span>{member.displayName}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            {conversionError && (
              <p className="field-error" role="alert">
                {conversionError}
              </p>
            )}
          </form>
        </Modal>
      )}

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
            defaultParticipationFee={defaultParticipationFee}
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
            onDefaultParticipationFeeChange={setDefaultParticipationFee}
            onGatheringTypeChange={(value) => {
              setGatheringType(value)
              if (value === 'EVENT') {
                setEndsOn(heldOn)
                setHostMemberId('')
                setIsRecurringClass(false)
              }
            }}
            onHostMemberIdChange={setHostMemberId}
            onHeldOnChange={setHeldOn}
            onLocationChange={setLocation}
            isRecurringClass={isRecurringClass}
            onRecurringClassChange={setIsRecurringClass}
            recurringWeeks={recurringWeeks}
            onRecurringWeeksChange={setRecurringWeeks}
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
          className="modal-content attendance-detail-modal"
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
                  {selectedGathering.classSeriesId !== null && (
                    <><ClassSeriesBadge /> · </>
                  )}
                  {selectedGathering.gatheringType === 'CLASS' && (
                    <>진행자 {selectedHost ?? '미지정'} · </>
                  )}
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
                  {selectedGathering.classSeriesId !== null && (
                    <button
                      className="secondary-button"
                      onClick={() => void openClassSeriesEnrollment()}
                      type="button"
                    >
                      선납 회원 관리
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
                    <li key={attendance.id}>
                      <strong>
                        {member?.displayName ?? '알 수 없는 회원'}
                      </strong>
                      {attendance.participationType !== 'NORMAL' && (
                        <span
                          className={`attendance-participation attendance-participation-${attendance.participationType.toLowerCase()}`}
                        >
                          {participationLabels[attendance.participationType]}
                        </span>
                      )}
                      <span
                        className={`payment-status payment-status-${attendance.paymentStatus.toLowerCase()}`}
                      >
                        {paymentStatusLabels[attendance.paymentStatus]}
                      </span>
                      {!readOnly &&
                        attendance.participationType !== 'HOST' &&
                        attendance.paymentStatus !== 'PREPAID' &&
                        selectedGathering.gatheringStatus !== 'CANCELLED' && (
                          <button
                            className="edit-button"
                            onClick={() => openPaymentEditor(attendance)}
                            type="button"
                          >
                            입금 관리
                          </button>
                        )}
                      {!readOnly &&
                        selectedGathering.gatheringStatus === 'OPEN' &&
                        attendance.participationType !== 'HOST' && (
                          <span className="attendance-row-actions">
                            <button
                              className="danger-button"
                              onClick={() => void cancelAttendance(attendance)}
                              type="button"
                            >
                              출석 취소
                            </button>
                          </span>
                        )}
                    </li>
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
              {selectedGathering.gatheringType === 'CLASS' &&
                selectedGathering.classSeriesId === null &&
                (selectedGathering.gatheringStatus === 'DRAFT' ||
                  selectedGathering.gatheringStatus === 'OPEN') && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      const gatheringToConvert = selectedGathering
                      setIsEditGatheringOpen(false)
                      setSelectedGatheringId(null)
                      window.setTimeout(
                        () => openExistingClassConversion(gatheringToConvert),
                        0,
                      )
                    }}
                    type="button"
                  >
                    수업 묶기
                  </button>
                )}
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
            defaultParticipationFee={editDefaultParticipationFee}
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
            onDefaultParticipationFeeChange={setEditDefaultParticipationFee}
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
      {isExpenseFormOpen && (
        <Modal
          ariaLabelledBy="settlement-expense-heading"
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsExpenseFormOpen(false)}
                type="button"
              >
                취소
              </button>
              <button form="settlement-expense-form" type="submit">
                저장
              </button>
            </>
          }
          onClose={() => setIsExpenseFormOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="settlement-expense-heading">지출 입력</h3>
            <p>연습실 대관비처럼 모임 운영을 위해 지출한 금액을 기록합니다.</p>
          </div>
          <form
            className="form"
            id="settlement-expense-form"
            onSubmit={createExpense}
          >
            <label>
              지출일
              <KoreanDateInput
                onChange={setExpenseDate}
                required
                value={expenseDate}
              />
            </label>
            <SelectField
              label="항목"
              onChange={(value) => setExpenseType(value as ExpenseType)}
              options={[
                { label: '대관비', value: 'RENTAL' },
                { label: '기타 지출', value: 'OTHER' },
              ]}
              value={expenseType}
            />
            {expenseType === 'RENTAL' ? (
              <label>
                대관 적용 월
                <KoreanMonthInput
                  onChange={setExpenseRentalMonth}
                  required
                  value={expenseRentalMonth}
                />
              </label>
            ) : (
              <label>
                분류
                <input
                  maxLength={100}
                  onChange={(event) => setExpenseCategory(event.target.value)}
                  required
                  value={expenseCategory}
                />
              </label>
            )}
            <label>
              설명 (선택)
              <input
                maxLength={200}
                onChange={(event) => setExpenseDescription(event.target.value)}
                value={expenseDescription}
              />
            </label>
            <label>
              금액
              <input
                min="0"
                onChange={(event) =>
                  setExpenseAmount(normalizeMoneyInput(event.target.value))
                }
                required
                step="1000"
                type="number"
                value={expenseAmount}
              />
            </label>
          </form>
        </Modal>
      )}
      {isClassSeriesEnrollmentOpen && selectedGathering?.classSeriesId && (
        <Modal
          ariaLabelledBy="class-series-enrollment-heading"
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setIsClassSeriesEnrollmentOpen(false)}
                type="button"
              >
                취소
              </button>
              <button
                disabled={isSavingClassSeriesEnrollment}
                form="class-series-enrollment-form"
                type="submit"
              >
                {isSavingClassSeriesEnrollment ? '등록 중…' : '선납 회원 등록'}
              </button>
            </>
          }
          onClose={() => setIsClassSeriesEnrollmentOpen(false)}
        >
          <div className="modal-heading">
            <h3 id="class-series-enrollment-heading">선납 회원 관리</h3>
            <p>
              선납 회원이 출석하면 해당 회차는 입금 관리 없이 선납 회원으로 표시됩니다. 결석분 환불은 자동 처리하지 않습니다.
            </p>
          </div>
          <form
            className="form class-series-enrollment-form"
            id="class-series-enrollment-form"
            onSubmit={saveClassSeriesEnrollment}
          >
            <SearchableMemberSelect
              label="회원"
              members={activeMembers.filter(
                (member) =>
                  !classSeriesEnrollments.some(
                    (enrollment) => enrollment.memberId === member.id,
                  ),
              )}
              onChange={setPrepaidMemberId}
              required
              value={prepaidMemberId}
            />
            <label>
              선납 금액
              <input
                min="0"
                onChange={(event) =>
                  setPrepaidAmount(normalizeMoneyInput(event.target.value))
                }
                required
                step="1000"
                type="number"
                value={prepaidAmount}
              />
              <span className="field-hint">
                기본값은 전체 수업 참가비입니다. 필요한 경우에만 수정해 주세요.
              </span>
            </label>
            {classSeriesEnrollmentError && (
              <p className="field-error" role="alert">
                {classSeriesEnrollmentError}
              </p>
            )}
          </form>
          <section className="class-series-enrollment-list" aria-label="등록된 선납 회원">
            <h4>등록된 선납 회원</h4>
            {classSeriesEnrollments.length === 0 ? (
              <p className="empty-copy">아직 등록된 선납 회원이 없습니다.</p>
            ) : (
              <ul>
                {classSeriesEnrollments.map((enrollment) => (
                  <li key={enrollment.id}>
                    <strong>
                      {membersById.get(enrollment.memberId)?.displayName ?? '이름 미확인'}
                    </strong>
                    <span>{formatWon(enrollment.paidAmount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Modal>
      )}

      {selectedPaymentAttendance && (
        <Modal
          ariaLabelledBy="attendance-payment-heading"
          footer={
            <>
              <button
                className="secondary-button"
                onClick={() => setSelectedPaymentAttendance(null)}
                type="button"
              >
                취소
              </button>
              <button form="attendance-payment-form" type="submit">
                저장
              </button>
            </>
          }
          onClose={() => setSelectedPaymentAttendance(null)}
        >
          <div className="modal-heading">
            <h3 id="attendance-payment-heading">참가비·입금 관리</h3>
            <p>
              {membersById.get(selectedPaymentAttendance.memberId)
                ?.displayName ?? '회원'}
              님의 적용 참가비와 입금 상태를 관리합니다.
            </p>
          </div>
          <form
            className="form"
            id="attendance-payment-form"
            onSubmit={saveAttendancePayment}
          >
            <div className="payment-fee-field">
              <span>적용 참가비</span>
              {isPaymentFeeEditing ? (
                <input
                  min="0"
                  onChange={(event) =>
                    setPaymentFee(normalizeMoneyInput(event.target.value))
                  }
                  required
                  step="1000"
                  type="number"
                  value={paymentFee}
                />
              ) : (
                <strong>{formatWon(Number(paymentFee))}</strong>
              )}
              <button
                className="secondary-button payment-fee-edit-button"
                onClick={() => {
                  if (isPaymentFeeEditing) {
                    setPaymentFee(String(selectedPaymentAttendance.appliedFee))
                  }
                  setIsPaymentFeeEditing((previous) => !previous)
                }}
                type="button"
              >
                {isPaymentFeeEditing ? '수정 취소' : '참가비 수정'}
              </button>
            </div>
            <div className="payment-status-options">
              <span>입금 상태</span>
              <div
                className="payment-status-buttons"
                role="group"
                aria-label="입금 상태"
              >
                {(['PENDING', 'PAID', 'EXEMPT'] as const).map((status) => (
                  <button
                    aria-pressed={paymentStatus === status}
                    className={
                      paymentStatus === status
                        ? 'is-selected'
                        : 'secondary-button'
                    }
                    key={status}
                    onClick={() => selectPaymentStatus(status)}
                    type="button"
                  >
                    {paymentStatusLabels[status]}
                  </button>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}
      {message && (
        <FeedbackMessageDialog
          message={message}
          onClose={() => setMessage('')}
        />
      )}
    </section>
  )
}
