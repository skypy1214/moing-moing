import { useEffect, useId, useMemo, useState } from 'react'

import type { Member } from '../../App'

type SearchableMemberSelectProps = {
  label: string
  members: Member[]
  onChange: (memberId: string) => void
  value: string
  includeWithdrawn?: boolean
  required?: boolean
}

function memberLabel(member: Member) {
  return `${member.displayName}${member.externalNickname ? ` · ${member.externalNickname}` : ''}${member.membershipStatus === 'WITHDRAWN' ? ' (탈퇴)' : ''}`
}

export function SearchableMemberSelect({
  label,
  members,
  onChange,
  value,
  includeWithdrawn = false,
}: SearchableMemberSelectProps) {
  const inputId = useId()
  const listboxId = useId()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const selectedMember = members.find((member) => member.id === value)

  useEffect(() => {
    setQuery(selectedMember ? memberLabel(selectedMember) : '')
  }, [selectedMember])

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return members
      .filter(
        (member) => includeWithdrawn || member.membershipStatus === 'ACTIVE',
      )
      .filter((member) => {
        if (normalizedQuery === '') {
          return true
        }
        return [member.displayName, member.externalNickname]
          .filter((field): field is string => field !== null)
          .some((field) => field.toLocaleLowerCase().includes(normalizedQuery))
      })
      .slice(0, 8)
  }, [includeWithdrawn, members, query])

  function selectMember(member: Member) {
    onChange(member.id)
    setQuery(memberLabel(member))
    setIsOpen(false)
  }

  return (
    <div
      className="searchable-member-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className={`member-autocomplete${isOpen ? ' is-open' : ''}`}>
        <input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          id={inputId}
          onChange={(event) => {
            setQuery(event.target.value)
            if (value !== '') {
              onChange('')
            }
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          placeholder="이름 또는 닉네임으로 검색"
          role="combobox"
          type="search"
          value={query}
        />
        {value !== '' && (
          <button
            aria-label={`${label} 선택 해제`}
            className="member-autocomplete-clear"
            onClick={() => {
              onChange('')
              setQuery('')
              setIsOpen(true)
            }}
            type="button"
          >
            ×
          </button>
        )}
        {isOpen && (
          <div
            className="member-autocomplete-options"
            id={listboxId}
            role="listbox"
          >
            {visibleMembers.length === 0 ? (
              <p>검색 결과가 없습니다.</p>
            ) : (
              visibleMembers.map((member) => (
                <button
                  aria-selected={member.id === value}
                  className={member.id === value ? 'is-selected' : undefined}
                  key={member.id}
                  onClick={() => selectMember(member)}
                  role="option"
                  type="button"
                >
                  <strong>{member.displayName}</strong>
                  {member.externalNickname && <span>{member.externalNickname}</span>}
                  {member.membershipStatus === 'WITHDRAWN' && <em>탈퇴</em>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
