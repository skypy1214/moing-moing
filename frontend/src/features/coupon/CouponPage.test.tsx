import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import { FeedbackDialogProvider } from '../../shared/feedback-dialog/FeedbackDialogProvider'
import { CouponPage } from './CouponPage'

describe('CouponPage', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('issues a manual coupon through the API', async () => {
    const user = userEvent.setup()
    const today = new Date().toISOString().slice(0, 10)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'coupon-1',
          memberId: 'member-1',
          couponType: 'MANUAL_FREE_PASS',
          couponStatus: 'ISSUED',
          validFrom: today,
          validUntil: today,
          totalUses: 1,
          remainingUses: 1,
          issuedReason: null,
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <FeedbackDialogProvider>
        <CouponPage
          members={[
            {
              id: 'member-1',
              displayName: '회원 한 명',
              externalNickname: null,
              membershipStatus: 'ACTIVE',
              memberRole: 'MEMBER',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
          ]}
        />
      </FeedbackDialogProvider>,
    )

    await user.click(screen.getByRole('button', { name: '쿠폰 발급' }))
    await user.type(screen.getByLabelText('쿠폰 이름'), '테스트 쿠폰')
    await user.type(screen.getByLabelText('회원'), '회원 한 명')
    await user.click(screen.getByRole('option', { name: /회원 한 명/ }))
    await user.click(screen.getByRole('button', { name: '쿠폰 발급' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/coupons', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: 'member-1',
          validFrom: today,
          validUntil: today,
          totalUses: 1,
          name: '테스트 쿠폰',
          issuedReason: null,
        }),
      }),
    )
  })

  it('filters members by a typed name before selecting a coupon recipient', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    )

    render(
      <FeedbackDialogProvider>
        <CouponPage
          members={[
            {
              id: 'member-1',
              displayName: '가나다',
              externalNickname: 'first',
              membershipStatus: 'ACTIVE',
              memberRole: 'MEMBER',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
            {
              id: 'member-2',
              displayName: '라마바',
              externalNickname: 'second',
              membershipStatus: 'ACTIVE',
              memberRole: 'MEMBER',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
          ]}
        />
      </FeedbackDialogProvider>,
    )

    await user.click(screen.getByRole('button', { name: '쿠폰 발급' }))
    await user.type(screen.getByLabelText('회원'), '라마')

    expect(screen.getByRole('option', { name: /라마바/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: /가나다/ }),
    ).not.toBeInTheDocument()
  })
})
