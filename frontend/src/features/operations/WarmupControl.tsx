import { useCallback, useEffect, useState } from 'react'

type WarmupStatus = {
  enabled: boolean
}

export function WarmupControl() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [message, setMessage] = useState('')

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/v1/admin/warmup', {
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('서버 깨우기 상태를 불러오지 못했습니다.')
    }
    const status = (await response.json()) as WarmupStatus
    setEnabled(status.enabled)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronous request updates server-backed state after this effect returns.
    void loadStatus().catch((error: unknown) =>
      setMessage(
        error instanceof Error
          ? error.message
          : '서버 깨우기 상태를 불러오지 못했습니다.',
      ),
    )
  }, [loadStatus])

  async function updateStatus(nextEnabled: boolean) {
    if (isUpdating || enabled === null || nextEnabled === enabled) return

    setIsUpdating(true)
    setMessage('')
    try {
      const response = await fetch('/api/v1/admin/warmup', {
        body: JSON.stringify({ enabled: nextEnabled }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PUT',
      })
      if (!response.ok) {
        throw new Error('서버 깨우기 설정을 바꾸지 못했습니다.')
      }
      const status = (await response.json()) as WarmupStatus
      setEnabled(status.enabled)
      setMessage(
        status.enabled
          ? '서버 깨우기를 켰습니다. 다음 Cron 실행부터 적용됩니다.'
          : '서버 깨우기를 껐습니다. Render와 Neon이 유휴 상태로 내려갈 수 있습니다.',
      )
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : '서버 깨우기 설정을 바꾸지 못했습니다.',
      )
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <section
      className="panel-section warmup-control"
      aria-labelledby="warmup-heading"
    >
      <div>
        <h3 id="warmup-heading">서버 깨우기</h3>
        <p>
          켜면 10분마다 Render를 호출합니다. 끄면 Cron이 Render와 Neon DB를
          깨우지 않습니다.
        </p>
      </div>
      <label className="warmup-control-switch">
        <input
          checked={enabled ?? false}
          disabled={enabled === null || isUpdating}
          onChange={(event) => void updateStatus(event.target.checked)}
          type="checkbox"
        />
        <span>{enabled === null ? '확인 중' : enabled ? '켜짐' : '꺼짐'}</span>
      </label>
      {message && <p className="description">{message}</p>}
    </section>
  )
}
