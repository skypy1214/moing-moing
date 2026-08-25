import type { FormEvent, ReactNode } from 'react'

import {
  MemberRoleIcon,
  memberRoleLabels,
  type MemberRole,
} from '../../shared/member/MemberRoleIcon'
import { KoreanDateInput } from '../../shared/ui/KoreanDateInput'

export type { MemberRole } from '../../shared/member/MemberRoleIcon'

type MemberProfileFormProps = {
  actions?: ReactNode
  displayName: string
  externalNickname: string
  fieldErrors: Record<string, string>
  joinedOn: string
  memo: string
  memberRole: MemberRole
  onDisplayNameChange: (value: string) => void
  onExternalNicknameChange: (value: string) => void
  onJoinedOnChange: (value: string) => void
  onMemberRoleChange: (value: MemberRole) => void
  onMemoChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  readOnly?: boolean
  submitLabel: string
}

const roleOptions: ReadonlyArray<{
  description: string
  label: string
  value: MemberRole
}> = [
  {
    value: 'LEADER',
    label: memberRoleLabels.LEADER,
    description: '소모임 대표',
  },
  { value: 'STAFF', label: memberRoleLabels.STAFF, description: '운영 보조' },
  {
    value: 'MEMBER',
    label: memberRoleLabels.MEMBER,
    description: '일반 참여자',
  },
]

export function MemberProfileForm({
  actions,
  displayName,
  externalNickname,
  fieldErrors,
  joinedOn,
  memo,
  memberRole,
  onDisplayNameChange,
  onExternalNicknameChange,
  onJoinedOnChange,
  onMemberRoleChange,
  onMemoChange,
  onSubmit,
  readOnly = false,
  submitLabel,
}: MemberProfileFormProps) {
  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        이름
        <input
          disabled={readOnly}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          required
          value={displayName}
        />
        {fieldErrors.displayName && (
          <span className="field-error">{fieldErrors.displayName}</span>
        )}
      </label>
      <label>
        소모임 닉네임 <span className="optional">(선택)</span>
        <input
          disabled={readOnly}
          onChange={(event) => onExternalNicknameChange(event.target.value)}
          value={externalNickname}
        />
      </label>
      <fieldset className="member-role-selector">
        <legend>역할</legend>
        <div className="member-role-options">
          {roleOptions.map((option) => {
            const isSelected = memberRole === option.value

            return (
              <label
                className={`member-role-option member-role-option-${option.value.toLowerCase()}${
                  isSelected ? ' member-role-option-selected' : ''
                }`}
                key={option.value}
              >
                <input
                  checked={isSelected}
                  disabled={readOnly}
                  name="member-role"
                  onChange={() => onMemberRoleChange(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span
                  className={`member-role-badge member-role-${option.value.toLowerCase()}`}
                >
                  <MemberRoleIcon decorative role={option.value} />
                  {option.label}
                </span>
                <span className="member-role-description">
                  {option.description}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <label>
        가입일
        <KoreanDateInput
          disabled={readOnly}
          onChange={onJoinedOnChange}
          required
          value={joinedOn}
        />
        {fieldErrors.joinedOn && (
          <span className="field-error">{fieldErrors.joinedOn}</span>
        )}
      </label>
      <label>
        메모 <span className="optional">(선택)</span>
        <textarea
          disabled={readOnly}
          onChange={(event) => onMemoChange(event.target.value)}
          value={memo}
        />
      </label>
      <div className="form-actions member-profile-actions">
        <button disabled={readOnly} type="submit">
          {submitLabel}
        </button>
        {actions}
      </div>
    </form>
  )
}
