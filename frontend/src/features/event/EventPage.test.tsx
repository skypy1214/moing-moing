import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { EventPage } from './EventPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('allows members to view draft event roles without rendering role confirmation', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input.endsWith('/api/v1/events')) {
        return {
          ok: true,
          json: async () => [
            { id: 'draft', name: '준비 중 이벤트', eventStatus: 'DRAFT' },
            { id: 'open', name: '선택 가능 이벤트', eventStatus: 'OPEN' },
          ],
        }
      }
      return {
        ok: true,
        json: async () => ({
          id: 'draft',
          name: '준비 중 이벤트',
          eventStatus: 'DRAFT',
          myRole: null,
          roles: [
            {
              id: 'role',
              section: 1,
              row: 1,
              column: 1,
              name: '역할',
              description: '설명',
              mission: null,
              taken: false,
            },
          ],
        }),
      }
    }),
  )

  render(<EventPage canViewMissions={false} isAdmin={false} />)

  expect(
    await screen.findByRole('button', {
      name: /준비 중 이벤트/,
    }),
  ).toBeEnabled()
  expect(screen.getByRole('button', { name: /선택 가능 이벤트/ })).toBeEnabled()

  await user.click(screen.getByRole('button', { name: /준비 중 이벤트/ }))
  await user.click(await screen.findByRole('button', { name: /역할/ }))

  expect(
    screen.queryByRole('button', { name: '이 역할로 확정' }),
  ).not.toBeInTheDocument()
})
