import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { apiFetch as fetch } from '../../shared/api/apiFetch'

type Account = {
  id: string
  loginId: string
  displayName: string
  role: 'ADMIN' | 'GROUP_LEADER' | 'STAFF' | 'MEMBER'
  status: 'ACTIVE' | 'DISABLED'
}

type ActivityLog = {
  id: string
  actorDisplayName: string | null
  action: string
  requestId: string | null
  status: number
  occurredAt: string
}

const roleLabels: Record<Account['role'], string> = {
  ADMIN: '관리자',
  GROUP_LEADER: '모임장',
  STAFF: '운영진',
  MEMBER: '회원',
}

function RoleField({
  onChange,
  role,
}: {
  onChange: (value: Account['role']) => void
  role: Account['role']
}) {
  return (
    <label>
      역할
      <select
        onChange={(event) => onChange(event.target.value as Account['role'])}
        value={role}
      >
        {Object.entries(roleLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function OperationsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [displayName, setDisplayName] = useState('')
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Account['role']>('MEMBER')
  const [editingRole, setEditingRole] = useState<Account | null>(null)
  const [resetPassword, setResetPassword] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const [accountResponse, logResponse] = await Promise.all([
      fetch('/api/v1/admin/accounts', { credentials: 'include' }),
      fetch('/api/v1/admin/activity-logs', { credentials: 'include' }),
    ])
    if (!accountResponse.ok || !logResponse.ok) {
      throw new Error('운영 관리 정보를 불러오지 못했습니다.')
    }
    setAccounts((await accountResponse.json()) as Account[])
    setLogs((await logResponse.json()) as ActivityLog[])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- The asynchronous request updates server-backed state after this effect returns.
    void load().catch((error: unknown) =>
      setMessage(
        error instanceof Error
          ? error.message
          : '운영 관리 정보를 불러오지 못했습니다.',
      ),
    )
  }, [load])

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await fetch('/api/v1/admin/accounts', {
      body: JSON.stringify({ displayName, loginId, password, role }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        message?: string
      } | null
      setMessage(error?.message ?? '운영 계정을 만들지 못했습니다.')
      return
    }
    setDisplayName('')
    setLoginId('')
    setPassword('')
    setRole('MEMBER')
    setMessage('운영 계정을 발급했습니다.')
    await load()
  }

  async function updateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingRole === null) return
    const response = await fetch(`/api/v1/admin/accounts/${editingRole.id}`, {
      body: JSON.stringify({
        displayName: editingRole.displayName,
        loginId: editingRole.loginId,
        role: editingRole.role,
      }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    })
    if (!response.ok) {
      setMessage('권한을 수정하지 못했습니다.')
      return
    }
    setEditingRole(null)
    setMessage('권한을 수정했습니다.')
    await load()
  }

  async function resetAccountPassword(account: Account) {
    if (
      !window.confirm(`${account.displayName} 계정의 비밀번호를 초기화할까요?`)
    )
      return
    const response = await fetch(
      `/api/v1/admin/accounts/${account.id}/reset-password`,
      {
        credentials: 'include',
        method: 'PATCH',
      },
    )
    if (!response.ok) {
      setMessage('비밀번호를 초기화하지 못했습니다.')
      return
    }
    const body = (await response.json()) as { temporaryPassword: string }
    setResetPassword(body.temporaryPassword)
    setMessage('비밀번호를 초기화했습니다.')
  }

  async function copyResetPassword() {
    if (resetPassword === null) return
    await navigator.clipboard.writeText(resetPassword)
    setMessage('임시 비밀번호를 복사했습니다.')
  }

  return (
    <section className="panel" aria-labelledby="operations-heading">
      <div className="panel-heading">
        <div>
          <h2 id="operations-heading">운영 관리</h2>
          <p>운영 계정 발급과 최근 작업 이력을 관리합니다.</p>
        </div>
        <button
          className="secondary-button"
          onClick={() => void load()}
          type="button"
        >
          새로고침
        </button>
      </div>

      <form className="form" onSubmit={createAccount}>
        <h3>운영 계정 발급</h3>
        <label>
          표시 이름
          <input
            onChange={(event) => setDisplayName(event.target.value)}
            required
            value={displayName}
          />
        </label>
        <label>
          로그인 ID
          <input
            onChange={(event) => setLoginId(event.target.value)}
            pattern="[A-Za-z0-9._-]{3,80}"
            required
            value={loginId}
          />
        </label>
        <label>
          초기 비밀번호
          <input
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <RoleField onChange={setRole} role={role} />
        <div className="form-actions">
          <button type="submit">계정 발급</button>
        </div>
      </form>

      <section
        className="panel-section"
        aria-labelledby="operator-account-heading"
      >
        <h3 id="operator-account-heading">운영 계정</h3>
        <ul className="plain-list">
          {accounts.map((account) => (
            <li key={account.id}>
              <strong>{account.displayName}</strong>
              <span>{account.loginId}</span>
              <span>{roleLabels[account.role]}</span>
              <span>{account.status === 'ACTIVE' ? '활성' : '비활성'}</span>
              <div className="operator-account-actions">
                <button
                  className="edit-button"
                  onClick={() => setEditingRole({ ...account })}
                  type="button"
                >
                  권한 수정
                </button>
                <button
                  className="secondary-button"
                  onClick={() => void resetAccountPassword(account)}
                  type="button"
                >
                  비밀번호 초기화
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-section" aria-labelledby="activity-log-heading">
        <h3 id="activity-log-heading">최근 작업 이력</h3>
        <ul className="plain-list">
          {logs.map((log) => (
            <li key={log.id}>
              <strong>{log.actorDisplayName ?? '작업자 없음'}</strong>
              <span>{log.action}</span>
              <span>{log.status}</span>
              <small>
                {new Date(log.occurredAt).toLocaleString('ko-KR')} ·{' '}
                {log.requestId ?? '요청 ID 없음'}
              </small>
            </li>
          ))}
        </ul>
      </section>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}

      {editingRole !== null && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditingRole(null)
          }}
        >
          <section
            aria-modal="true"
            aria-labelledby="operator-role-heading"
            className="modal-content member-action-modal"
            role="dialog"
          >
            <div className="modal-scroll-content">
              <div className="modal-heading">
                <h3 id="operator-role-heading">권한 수정</h3>
                <p>{editingRole.displayName} 계정의 역할을 변경합니다.</p>
              </div>
              <form className="form" onSubmit={updateRole}>
                <RoleField
                  onChange={(role) =>
                    setEditingRole((account) =>
                      account === null ? null : { ...account, role },
                    )
                  }
                  role={editingRole.role}
                />
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setEditingRole(null)}
                    type="button"
                  >
                    취소
                  </button>
                  <button type="submit">저장</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {resetPassword !== null && (
        <div className="modal-backdrop">
          <section
            aria-modal="true"
            aria-labelledby="reset-password-heading"
            className="modal-content member-action-modal"
            role="dialog"
          >
            <div className="modal-scroll-content">
              <div className="modal-heading">
                <h3 id="reset-password-heading">임시 비밀번호</h3>
                <p>
                  이 창을 닫으면 다시 확인할 수 없습니다. 계정 사용자에게
                  안전하게 전달해 주세요.
                </p>
              </div>
              <label>
                임시 비밀번호
                <input readOnly value={resetPassword} />
              </label>
              <div className="form-actions">
                <button
                  className="secondary-button"
                  onClick={() => void copyResetPassword()}
                  type="button"
                >
                  복사
                </button>
                <button onClick={() => setResetPassword(null)} type="button">
                  확인
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
