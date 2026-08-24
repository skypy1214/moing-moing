import { useEffect, useMemo, useState } from 'react'

import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { EmptyState } from '../../shared/ui/EmptyState'
import { formatKoreanDate } from '../../shared/ui/KoreanDateInput'

type Attendance = {
  id: string
  gatheringId: string
  participationType: 'NORMAL' | 'COUPON' | 'HOST'
  attendanceStatus: 'RECORDED' | 'CANCELLED'
}

type Gathering = {
  id: string
  heldOn: string
  gatheringType: 'CLASS' | 'EVENT'
  endsOn: string | null
  title: string | null
}

type GatheringFilter = 'ALL' | Gathering['gatheringType']

const gatheringTypeLabels: Record<Gathering['gatheringType'], string> = {
  CLASS: '수업',
  EVENT: '행사',
}

const participationLabels: Record<Attendance['participationType'], string> = {
  HOST: '진행자',
  NORMAL: '출석',
  COUPON: '쿠폰 사용',
}

function gatheringPeriodLabel(gathering: Gathering) {
  if (gathering.endsOn === null || gathering.endsOn === gathering.heldOn) {
    return formatKoreanDate(gathering.heldOn)
  }
  return `${formatKoreanDate(gathering.heldOn)} ~ ${formatKoreanDate(gathering.endsOn)}`
}

type MemberParticipationHistoryProps = {
  memberId: string
  standalone?: boolean
}

export function MemberParticipationHistory({
  memberId,
  standalone = false,
}: MemberParticipationHistoryProps) {
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [gatherings, setGatherings] = useState<Gathering[]>([])
  const [filter, setFilter] = useState<GatheringFilter>('ALL')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true

    async function loadParticipationHistory() {
      setIsLoading(true)
      setError('')
      setFilter('ALL')
      try {
        const [attendanceResponse, gatheringResponse] = await Promise.all([
          fetch(`/api/v1/members/${memberId}/attendance-history`, {
            credentials: 'include',
          }),
          fetch('/api/v1/gatherings', { credentials: 'include' }),
        ])
        if (!attendanceResponse.ok || !gatheringResponse.ok) {
          throw new Error('참여 이력을 불러오지 못했습니다.')
        }
        if (!isCurrent) return
        setAttendances((await attendanceResponse.json()) as Attendance[])
        setGatherings((await gatheringResponse.json()) as Gathering[])
      } catch (loadError) {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : '참여 이력을 불러오지 못했습니다.',
          )
        }
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    void loadParticipationHistory()
    return () => {
      isCurrent = false
    }
  }, [memberId])

  const gatheringsById = useMemo(
    () => new Map(gatherings.map((gathering) => [gathering.id, gathering])),
    [gatherings],
  )
  const participationHistory = useMemo(
    () =>
      attendances
        .filter((attendance) => attendance.attendanceStatus === 'RECORDED')
        .map((attendance) => ({
          attendance,
          gathering: gatheringsById.get(attendance.gatheringId),
        }))
        .filter(
          (item): item is { attendance: Attendance; gathering: Gathering } =>
            item.gathering !== undefined &&
            (filter === 'ALL' || item.gathering.gatheringType === filter),
        )
        .sort((left, right) => right.gathering.heldOn.localeCompare(left.gathering.heldOn)),
    [attendances, filter, gatheringsById],
  )

  return (
    <section
      aria-labelledby="member-participation-history-heading"
      className={standalone ? 'member-participation-page-content' : 'subsection'}
    >
      <div className="member-participation-heading">
        <div>
          <h3 id="member-participation-history-heading">참여 이력</h3>
          <p className="description">지금까지 참여한 수업과 행사입니다.</p>
        </div>
        <div aria-label="정모 구분 필터" className="member-participation-filters" role="group">
          {([
            ['ALL', '전체'],
            ['CLASS', '수업'],
            ['EVENT', '행사'],
          ] as const).map(([value, label]) => (
            <button
              className={filter === value ? 'is-active' : 'secondary-button'}
              key={value}
              onClick={() => setFilter(value)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <p className="description">참여 이력을 불러오는 중입니다.</p>
      ) : error ? (
        <p className="field-error" role="alert">{error}</p>
      ) : participationHistory.length === 0 ? (
        <EmptyState
          description="참여 기록이 생기면 수업과 행사별로 여기에 표시됩니다."
          icon="✓"
          title="참여 이력이 없습니다"
        />
      ) : (
        <ul className="member-participation-list">
          {participationHistory.map(({ attendance, gathering }) => (
            <li key={attendance.id}>
              <div>
                <strong>{gathering.title ?? '제목 없는 정모'}</strong>
                <span>{gatheringPeriodLabel(gathering)}</span>
              </div>
              <div className="member-participation-badges">
                <span className={`status gathering-type-${gathering.gatheringType.toLowerCase()}`}>
                  {gatheringTypeLabels[gathering.gatheringType]}
                </span>
                <span
                  className={`attendance-participation attendance-participation-${attendance.participationType.toLowerCase()}`}
                >
                  {participationLabels[attendance.participationType]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
