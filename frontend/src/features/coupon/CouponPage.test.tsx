import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { CouponPage } from './CouponPage'

describe('CouponPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('issues a manual coupon through the API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'coupon-1',
        memberId: 'member-1',
        couponType: 'MANUAL_FREE_PASS',
        couponStatus: 'ISSUED',
        validFrom: '2026-08-21',
        validUntil: '2026-08-21',
        totalUses: 1,
        remainingUses: 1,
        issuedReason: null,
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <CouponPage
        members={[
          {
            id: 'member-1',
            displayName: '회원 한 명',
            externalNickname: null,
            membershipStatus: 'ACTIVE',
            joinedOn: '2026-08-21',
            withdrawnOn: null,
            memo: null,
          },
        ]}
      />,
    )

    await user.selectOptions(screen.getByLabelText('회원'), 'member-1')
    await user.click(screen.getByRole('button', { name: '쿠폰 발급' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/coupons', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: 'member-1',
          validFrom: '2026-08-21',
          validUntil: '2026-08-21',
          totalUses: 1,
          issuedReason: null,
        }),
      }),
    )
  })
})
