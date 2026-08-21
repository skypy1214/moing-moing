import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { MonthlyStatisticsPage } from './MonthlyStatisticsPage'

describe('MonthlyStatisticsPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads monthly statistics through the API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        month: '2026-08',
        policyVersion: 'draft-v1',
        attendanceNumerator: 1,
        activityNumerator: 1,
        denominator: 1,
        attendanceRate: 1,
        activityRate: 1,
        targetMembers: [{ id: 'member-1', displayName: '회원 한 명' }],
        attendedMemberIds: ['member-1'],
        activityExcludedMemberIds: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<MonthlyStatisticsPage />)

    await user.click(screen.getByRole('button', { name: '통계 조회' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/statistics/monthly?month=2026-08',
        { credentials: 'include' },
      ),
    )
    expect(await screen.findAllByText('100%')).toHaveLength(2)
    expect(screen.getByText('출석 회원: 회원 한 명')).toBeInTheDocument()
  })
})
