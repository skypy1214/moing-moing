import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

import App from './App'

describe('App', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the administrator login form', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<App />)

    expect(
      screen.getByRole('heading', { name: '운영진 관리' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('로그인 ID')).toBeInTheDocument()
    expect(screen.getByLabelText('비밀번호')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
  })

  it('opens development demo mode with the temporary administrator account', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<App />)

    await user.type(screen.getByLabelText('로그인 ID'), 'admin')
    await user.type(screen.getByLabelText('비밀번호'), 'admin')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(
      screen.getByRole('heading', { name: '회원 관리' }),
    ).toBeInTheDocument()
    expect(screen.getByText('데모 회원')).toBeInTheDocument()
    expect(screen.getByText(/개발 전용 데모 모드/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('회원 상태'), 'WITHDRAWN')
    expect(
      screen.getByRole('button', { name: /탈퇴 회원/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /데모 회원/ }),
    ).not.toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('회원 상태'), 'ALL')
    await user.click(screen.getByRole('button', { name: /데모 회원/ }))
    expect(
      screen.getByRole('heading', { name: '회원 상세' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '활동 중단 시작' }))
    expect(screen.getByText(/데모 활동 중단 기간을 등록/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '수정' }))
    await user.click(
      screen.getByRole('button', { name: '활동 중단 기간 저장' }),
    )
    expect(screen.getByText(/데모 활동 중단 기간을 수정/)).toBeInTheDocument()
  })

  it('creates and opens a development attendance ledger', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    render(<App />)

    await user.type(screen.getByLabelText('로그인 ID'), 'admin')
    await user.type(screen.getByLabelText('비밀번호'), 'admin')
    await user.click(screen.getByRole('button', { name: '로그인' }))
    await user.click(screen.getByRole('button', { name: '출석 관리' }))

    expect(screen.getAllByRole('heading', { name: '출석 관리' })).toHaveLength(
      2,
    )
    expect(
      screen.getByRole('heading', { name: '출석 캘린더' }),
    ).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: /선택$/ })[0])
    expect(
      screen.getByRole('dialog', { name: '새 출석부 만들기' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '출석부 초안 만들기' }))
    await user.click(screen.getByRole('button', { name: '출석 시작' }))
    await user.selectOptions(
      screen.getAllByLabelText('회원')[1],
      'demo-member-1',
    )
    await user.click(screen.getByRole('button', { name: '출석 기록' }))

    expect(
      screen.getByText('개발용 출석 기록을 추가했습니다.'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '출석 취소' }))
    await user.type(screen.getByLabelText('출석 취소 사유'), '입력 실수')
    await user.click(screen.getByRole('button', { name: '취소 확정' }))
    expect(
      screen.getByText('개발용 출석 기록을 취소했습니다. 기록은 보존됩니다.'),
    ).toBeInTheDocument()

    await user.selectOptions(
      screen.getAllByLabelText('회원')[0],
      'demo-member-1',
    )
    await user.click(screen.getByRole('button', { name: '이력 조회' }))
    expect(screen.getByText('취소됨: 입력 실수')).toBeInTheDocument()
  })
})
