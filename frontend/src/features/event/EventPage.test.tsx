import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import { EventPage } from './EventPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('shows draft events to members without allowing detail access', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { id: 'draft', name: '준비 중 이벤트', eventStatus: 'DRAFT' },
        { id: 'open', name: '선택 가능 이벤트', eventStatus: 'OPEN' },
      ],
    }),
  )

  render(<EventPage canViewMissions={false} isAdmin={false} />)

  expect(
    await screen.findByRole('button', {
      name: '준비 중 이벤트 (준비 중 - 열람 불가)',
    }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: '선택 가능 이벤트' })).toBeEnabled()
})
