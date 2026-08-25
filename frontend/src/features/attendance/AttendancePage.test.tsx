import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { AttendancePage } from './AttendancePage'

vi.mock('../../shared/feedback-dialog/useFeedbackDialog', () => ({
  useFeedbackDialog: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}))

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

    await user.click(screen.getAllByRole('button', { name: /선택/ })[0])

    const dialog = screen.getByRole('dialog', { name: '정모 개설' })
    expect(dialog.querySelector('.modal-header')).toContainElement(
      screen.getByRole('button', { name: '모달 닫기' }),
    )

    await user.click(screen.getByRole('button', { name: '모달 닫기' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the gathering creation error inside the modal', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({}),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<AttendancePage members={[]} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getAllByRole('button', { name: /선택/ })[0])
    await user.click(screen.getByRole('button', { name: '정모 개설' }))

    expect(
      await screen.findByText(
        '권한이 없습니다. 관리자 계정으로 다시 로그인해 주세요.',
      ),
    ).toBeInTheDocument()
  })

  it('shows cancelled gatherings in a paged history modal', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'cancelled-gathering-1',
              heldOn: '2026-08-20',
              title: '취소된 정모',
              startsAt: null,
              location: null,
              gatheringStatus: 'CANCELLED',
              cancelledAt: '2026-08-19T12:00:00Z',
              cancellationReason: '장소 사정',
            },
          ],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<AttendancePage members={[]} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: '정모 취소 이력' }))

    expect(await screen.findByText('취소된 정모')).toBeInTheDocument()
    expect(screen.getByText('장소 사정')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/gatherings/cancellations?page=0&size=10',
      { credentials: 'include' },
    )
  })

  it('opens gathering creation when the calendar cell is selected', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AttendancePage members={[]} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await user.click(screen.getAllByRole('button', { name: /선택/ })[0])

    expect(
      await screen.findByRole('dialog', { name: '정모 개설' }),
    ).toBeInTheDocument()
  })
})
