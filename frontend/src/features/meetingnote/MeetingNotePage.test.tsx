import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MeetingNotePage } from './MeetingNotePage'

describe('MeetingNotePage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders GFM task lists and tables while keeping raw HTML out of the preview', () => {
    vi.stubGlobal('fetch', vi.fn())

    render(<MeetingNotePage isDemoMode />)

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
})
