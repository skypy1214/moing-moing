import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { apiFetch as fetch } from '../../shared/api/apiFetch'
import { FeedbackMessageDialog } from '../../shared/feedback-dialog/FeedbackMessageDialog'
import { EmptyState } from '../../shared/ui/EmptyState'
import { KoreanDateInput } from '../../shared/ui/KoreanDateInput'
import { RefreshIcon } from '../../shared/ui/RefreshIcon'
import { SelectField } from '../../shared/ui/SelectField'
import type { Account, ActivityLogPage as ActivityLogPageResult } from './types'

type ActivityLogPageProps = {
  onBack: () => void
}

export function ActivityLogPage({ onBack }: ActivityLogPageProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [actorLoginId, setActorLoginId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [result, setResult] = useState<ActivityLogPageResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')

  const accountOptions = useMemo(
    () => [
      { label: '전체 작업자', value: '' },
      ...accounts.map((account) => ({
        label: `${account.displayName} (${account.loginId})`,
        value: account.loginId,
      })),
    ],
    [accounts],
  )

  const loadAccounts = useCallback(async () => {
    const response = await fetch('/api/v1/admin/accounts', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('운영 계정 목록을 불러오지 못했습니다.')
    }
    setAccounts((await response.json()) as Account[])
  }, [])

  const loadLogs = useCallback(
    async (
      filters: { actorLoginId: string; fromDate: string; toDate: string },
      page = 0,
    ) => {
      setIsLoading(true)
      const searchParams = new URLSearchParams({
        page: String(page),
        size: '20',
      })
      if (filters.actorLoginId !== '') {
        searchParams.set('actorLoginId', filters.actorLoginId)
      }
      if (filters.fromDate !== '')
        searchParams.set('fromDate', filters.fromDate)
      if (filters.toDate !== '') searchParams.set('toDate', filters.toDate)

      try {
        const response = await fetch(
          `/api/v1/admin/activity-logs?${searchParams.toString()}`,
          { credentials: 'include' },
        )
        if (!response.ok) {
          const error = (await response.json().catch(() => null)) as {
            message?: string
          } | null
          throw new Error(error?.message ?? '작업 이력을 불러오지 못했습니다.')
        }
        setResult((await response.json()) as ActivityLogPageResult)
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : '작업 이력을 불러오지 못했습니다.',
        )
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const loadInitialData = useCallback(
    () =>
      Promise.all([
        loadAccounts(),
        loadLogs({ actorLoginId: '', fromDate: '', toDate: '' }),
      ]),
    [loadAccounts, loadLogs],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronous requests update server-backed state after this effect returns.
    void loadInitialData().catch((error: unknown) =>
      setMessage(
        error instanceof Error
          ? error.message
          : '작업 이력을 불러오지 못했습니다.',
      ),
    )
  }, [loadInitialData])

  function loadFilteredLogs(page = 0) {
    void loadLogs({ actorLoginId, fromDate, toDate }, page)
  }

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    loadFilteredLogs()
  }

  return (
    <section
      className="panel activity-log-page"
      aria-labelledby="activity-log-heading"
    >
      <div className="panel-heading">
        <div>
          <h2 id="activity-log-heading">작업 이력</h2>
          <p>작업자와 기간을 기준으로 운영 작업을 확인합니다.</p>
        </div>
        <div className="header-actions">
          <button className="secondary-button" onClick={onBack} type="button">
            운영 관리로 돌아가기
          </button>
          <button
            aria-label="작업 이력 새로고침"
            className="secondary-button icon-button"
            onClick={() => loadFilteredLogs(result?.page ?? 0)}
            title="새로고침"
            type="button"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      <form className="activity-log-filters" onSubmit={submitFilters}>
        <SelectField
          label="작업자 ID"
          onChange={setActorLoginId}
          options={accountOptions}
          value={actorLoginId}
        />
        <label>
          시작일
          <KoreanDateInput onChange={setFromDate} value={fromDate} />
        </label>
        <label>
          종료일
          <KoreanDateInput onChange={setToDate} value={toDate} />
        </label>
        <button type="submit">조회</button>
      </form>

      {isLoading ? (
        <p className="empty-state">작업 이력을 불러오는 중입니다.</p>
      ) : result === null || result.items.length === 0 ? (
        <EmptyState
          description="선택한 조건에 해당하는 작업 이력이 없습니다."
          icon="○"
          title="작업 이력이 없습니다"
        />
      ) : (
        <ul className="activity-log-list">
          {result.items.map((log) => (
            <li key={log.id}>
              <div>
                <strong>{log.actorDisplayName ?? '작업자 없음'}</strong>
                <span>{log.action}</span>
              </div>
              <div>
                <span className="status">{log.status}</span>
                <small>
                  {new Date(log.occurredAt).toLocaleString('ko-KR')} ·{' '}
                  {log.requestId ?? '요청 ID 없음'}
                </small>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="pagination-controls">
        <button
          className="secondary-button"
          disabled={isLoading || (result?.page ?? 0) === 0}
          onClick={() => loadFilteredLogs((result?.page ?? 0) - 1)}
          type="button"
        >
          이전
        </button>
        <span>
          {result === null || result.totalElements === 0
            ? '0건'
            : `${result.page + 1} / ${result.totalPages} 페이지`}
        </span>
        <button
          className="secondary-button"
          disabled={
            isLoading || result === null || result.page + 1 >= result.totalPages
          }
          onClick={() => loadFilteredLogs((result?.page ?? 0) + 1)}
          type="button"
        >
          다음
        </button>
      </div>

      {message && (
        <FeedbackMessageDialog
          message={message}
          onClose={() => setMessage('')}
        />
      )}
    </section>
  )
}
