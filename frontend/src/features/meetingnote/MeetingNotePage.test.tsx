import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MeetingNotePage } from './MeetingNotePage'

describe('MeetingNotePage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders GFM task lists and tables while keeping raw HTML out of the preview', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<MeetingNotePage />)

    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    expect(screen.getByRole('table')).toBeInTheDocument()

    const markdownInput = screen.getAllByRole('textbox').at(-1)
    if (markdownInput === undefined) {
      throw new Error('Markdown editor was not rendered.')
    }
    fireEvent.change(markdownInput, {
      target: { value: '<script>alert("unsafe")</script>' },
    })

    expect(screen.queryByText('unsafe')).not.toBeInTheDocument()
  })

  it('loads categories and notes through the API on entry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'category-1',
            name: '운영',
            color: '#2463A5',
            sortOrder: 0,
            active: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'note-1',
            categoryId: 'category-1',
            title: '정기 회의',
            markdownContent: '내용',
            noteStatus: 'PUBLISHED',
            createdAt: '2026-08-21T00:00:00Z',
          },
        ],
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<MeetingNotePage />)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/meeting-note-categories',
        {
          credentials: 'include',
        },
      ),
    )
    expect(
      await screen.findByRole('button', { name: /정기 회의/ }),
    ).toBeInTheDocument()
  })
})
