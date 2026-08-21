import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { AttendancePage } from './AttendancePage'

describe('AttendancePage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('loads a gathering and its attendance records through the API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'gathering-1',
            heldOn: '2026-08-21',
            title: '정기 모임',
            startsAt: null,
            location: null,
            gatheringStatus: 'OPEN',
          },
        ],
      })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
    vi.stubGlobal('fetch', fetchMock)

    render(<AttendancePage members={[]} />)

    await user.click(screen.getByRole('button', { name: '새로고침' }))
    await user.click(
      (await screen.findAllByRole('button', { name: /정기 모임/ }))[0],
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/v1/gatherings/gathering-1/attendances',
        { credentials: 'include' },
      ),
    )
  })

  it('places the close control in a separate modal header', async () => {
    const user = userEvent.setup()

    render(<AttendancePage members={[]} />)

    await user.click(screen.getByRole('button', { name: '새 출석부 만들기' }))

    const dialog = screen.getByRole('dialog', { name: '새 출석부 만들기' })
    expect(dialog.querySelector('.modal-header')).toContainElement(
      screen.getByRole('button', { name: '모달 닫기' }),
    )

    await user.click(screen.getByRole('button', { name: '모달 닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
