import { useState } from 'react'

import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { FeedbackMessageDialog } from '../../shared/feedback-dialog/FeedbackMessageDialog'
import { KoreanMonthInput } from '../../shared/ui/KoreanMonthInput'

type MonthlyStatistics = {
  month: string
  attendanceNumerator: number
  activityNumerator: number
  denominator: number
  attendanceRate: number
  activityRate: number
  targetMembers: { id: string; displayName: string }[]
  attendedMemberIds: string[]
  activityExcludedMemberIds: string[]
}

const currentMonth = new Date().toISOString().slice(0, 7)

export function MonthlyStatisticsPage() {
  const [month, setMonth] = useState(currentMonth)
  const [statistics, setStatistics] = useState<MonthlyStatistics | null>(null)
  const [message, setMessage] = useState('')

  async function loadStatistics() {
    const response = await fetch(`/api/v1/statistics/monthly?month=${month}`, {
      credentials: 'include',
    })
    if (!response.ok) {
      setMessage('월별 통계를 불러오지 못했습니다.')
      return
    }
    setStatistics((await response.json()) as MonthlyStatistics)
  }

  return (
    <section className="coupon-page">
      <div className="attendance-page-heading">
        <div>
          <p className="eyebrow">STATISTICS</p>
          <h2>{'월별 통계'}</h2>
          <p>{'출석률과 활동률의 계산 근거를 함께 확인합니다.'}</p>
        </div>
      </div>
      <section className="panel">
        <div className="inline-form">
          <label>
            {'대상 월'}
            <KoreanMonthInput onChange={setMonth} required value={month} />
          </label>
          <button onClick={() => void loadStatistics()} type="button">
            {'통계 조회'}
          </button>
        </div>
        {statistics && (
          <div className="statistics-grid">
            <article>
              <strong>{'출석률'}</strong>
              <b>{Math.round(statistics.attendanceRate * 100)}%</b>
              <span>
                {statistics.attendanceNumerator}
                {' / '}
                {statistics.denominator}
                {'명'}
              </span>
            </article>
            <article>
              <strong>{'활동률'}</strong>
              <b>{Math.round(statistics.activityRate * 100)}%</b>
              <span>
                {statistics.activityNumerator}
                {' / '}
                {statistics.denominator}
                {'명'}
              </span>
            </article>
            <article>
              <strong>{'해당 월 모임원'}</strong>
              <b>
                {statistics.denominator}
                {'명'}
              </b>
              <span>{'가입·탈퇴 기간이 해당 월과 겹친 회원'}</span>
            </article>
          </div>
        )}
        {statistics && (
          <section className="subsection">
            <h3>{'계산 근거'}</h3>
            <p>
              {'출석 회원: '}
              {statistics.targetMembers
                .filter((member) =>
                  statistics.attendedMemberIds.includes(member.id),
                )
                .map((member) => member.displayName)
                .join(', ') || '없음'}
            </p>
            <p>
              {'활동 중단 포함 회원: '}
              {statistics.targetMembers
                .filter((member) =>
                  statistics.activityExcludedMemberIds.includes(member.id),
                )
                .map((member) => member.displayName)
                .join(', ') || '없음'}
            </p>
          </section>
        )}
        {message && (
          <FeedbackMessageDialog
            message={message}
            onClose={() => setMessage('')}
          />
        )}
      </section>
    </section>
  )
}
