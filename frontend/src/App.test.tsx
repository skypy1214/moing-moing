import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import App from './App'
import { FeedbackDialogProvider } from './shared/feedback-dialog/FeedbackDialogProvider'

function renderApp() {
  return render(
    <FeedbackDialogProvider>
      <App />
    </FeedbackDialogProvider>,
  )
}

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the administrator login form', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

    renderApp()

    expect(
      screen.getByRole('heading', { name: '운영진 관리' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('로그인 ID')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '게스트로 둘러보기' }),
    ).toBeInTheDocument()
  })

  it('starts a guest session with read-only member browsing', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'member-1',
              displayName: '조회 회원',
              externalNickname: null,
              membershipStatus: 'ACTIVE',
              memberRole: 'MEMBER',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
          ],
        }),
    )

    renderApp()

    await user.click(screen.getByRole('button', { name: '게스트로 둘러보기' }))

    expect(await screen.findByText('읽기 전용')).toBeInTheDocument()
    expect(screen.getByText('조회 회원')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: '새 회원 등록' }),
    ).not.toBeInTheDocument()
  })

  it('logs in through the API and loads members', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
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
          ],
        })
        .mockResolvedValueOnce({ ok: true, json: async () => [] })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'member-1',
            displayName: '회원 한 명',
            externalNickname: null,
            membershipStatus: 'ACTIVE',
            memberRole: 'STAFF',
            joinedOn: '2026-08-21',
            withdrawnOn: null,
            memo: null,
          }),
        }),
    )

    renderApp()

    await user.type(screen.getByLabelText('로그인 ID'), 'administrator')
    await user.type(screen.getByLabelText('비밀번호'), 'safe-password')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      await screen.findByRole('heading', { name: '회원 관리' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /회원 한 명/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /회원 한 명/ }))
    expect(
      await screen.findByRole('dialog', { name: '회원 한 명' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '상세 보기' }))
    expect(
      screen.queryByRole('dialog', { name: '회원 한 명' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: '회원 상세' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /운영진/ }))
    await user.click(screen.getByRole('button', { name: '저장' }))

    expect(
      await screen.findByRole('dialog', { name: '회원 정보 저장 완료' }),
    ).toBeInTheDocument()
    expect(screen.getByText('역할 정보를 저장했습니다.')).toBeInTheDocument()
  })

  it('prioritizes leadership roles in the member list', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              id: 'member-1',
              displayName: '일반 회원',
              externalNickname: null,
              membershipStatus: 'ACTIVE',
              memberRole: 'MEMBER',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
            {
              id: 'member-2',
              displayName: '운영진 회원',
              externalNickname: null,
              membershipStatus: 'ACTIVE',
              memberRole: 'STAFF',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
            {
              id: 'member-3',
              displayName: '모임장 회원',
              externalNickname: null,
              membershipStatus: 'ACTIVE',
              memberRole: 'LEADER',
              joinedOn: '2026-08-21',
              withdrawnOn: null,
              memo: null,
            },
          ],
        }),
    )

    const { container } = renderApp()

    await user.type(screen.getByLabelText('로그인 ID'), 'administrator')
    await user.type(screen.getByLabelText('비밀번호'), 'safe-password')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    await screen.findByText('모임장 회원')
    const memberRows = Array.from(container.querySelectorAll('.member-row'))
    expect(memberRows.map((button) => button.textContent)).toEqual([
      expect.stringContaining('모임장 회원'),
      expect.stringContaining('운영진 회원'),
      expect.stringContaining('일반 회원'),
    ])

    expect(screen.getByText('일반 회원')).toBeInTheDocument()
    expect(screen.getByText('운영진 회원')).toBeInTheDocument()
    expect(screen.getByText('모임장 회원')).toBeInTheDocument()
  })
})
