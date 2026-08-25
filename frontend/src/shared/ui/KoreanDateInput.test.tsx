import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { KoreanDateInput } from './KoreanDateInput'

describe('KoreanDateInput', () => {
  it('keeps the year-month-day order while typing and offers a calendar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(<KoreanDateInput onChange={onChange} required value="" />)

    const input = screen.getByLabelText('날짜')
    await user.type(input, '20260821')

    expect(input).toHaveValue('2026/08/21')
    expect(onChange).toHaveBeenLastCalledWith('2026-08-21')
    expect(
      screen.getByRole('dialog', { name: '날짜 선택' }),
    ).toBeInTheDocument()
  })
})
