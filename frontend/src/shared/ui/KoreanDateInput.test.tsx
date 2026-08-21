import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { KoreanDateInput } from './KoreanDateInput'

describe('KoreanDateInput', () => {
  it('accepts a year-first eight-digit date and exposes an ISO value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<KoreanDateInput onChange={onChange} required value="" />)

    await user.type(screen.getByRole('textbox', { name: '날짜' }), '20260821')

    expect(screen.getByRole('textbox', { name: '날짜' })).toHaveValue(
      '2026.08.21',
    )
    expect(onChange).toHaveBeenLastCalledWith('2026-08-21')
  })
})
