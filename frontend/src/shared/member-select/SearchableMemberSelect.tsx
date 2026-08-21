import { useMemo, useState } from 'react'

import type { Member } from '../../App'

type SearchableMemberSelectProps = {
  label: string
  members: Member[]
  onChange: (memberId: string) => void
  value: string
  includeWithdrawn?: boolean
  required?: boolean
}

export function SearchableMemberSelect({
  label,
  members,
  onChange,
  value,
  includeWithdrawn = false,
  required = false,
}: SearchableMemberSelectProps) {
  const [query, setQuery] = useState('')
  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return members.filter((member) => {
      if (!includeWithdrawn && member.membershipStatus !== 'ACTIVE') {
        return member.id === value
      }
      if (member.id === value || normalizedQuery === '') {
        return true
      }
      return [member.displayName, member.externalNickname]
        .filter((field): field is string => field !== null)
        .some((field) => field.toLocaleLowerCase().includes(normalizedQuery))
    })
  }, [includeWithdrawn, members, query, value])

  return (
    <div className="searchable-member-select">
      <label>
        {`${label} 검색`}
        <input
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 닉네임"
          type="search"
          value={query}
        />
      </label>
      <label>
        {`${label} 선택`}
        <select
          onChange={(event) => onChange(event.target.value)}
          required={required}
          value={value}
        >
          <option value="">{'선택'}</option>
          {visibleMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
              {member.externalNickname && ` · ${member.externalNickname}`}
              {member.membershipStatus === 'WITHDRAWN' ? ' (탈퇴)' : ''}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
