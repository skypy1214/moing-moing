import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { Member } from '../../App'
import { useFloatingOptions } from '../ui/useFloatingOptions'

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
  const inputContainerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedMember = members.find((member) => member.id === value)
  const { optionsRef, style } = useFloatingOptions({
    anchorRef: inputContainerRef,
    isOpen,
    onRequestClose: () => setIsOpen(false),
  })

  useEffect(() => {
    setQuery(selectedMember ? memberLabel(selectedMember) : '')
  }, [selectedMember])

  const visibleMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (normalizedQuery === '') {
      return []
    }

    return members
      .filter(
        (member) => includeWithdrawn || member.membershipStatus === 'ACTIVE',
      )
      .filter((member) =>
        [member.displayName, member.externalNickname]
          .filter((field): field is string => field !== null)
          .some((field) => field.toLocaleLowerCase().includes(normalizedQuery)),
      )
      .slice(0, 8)
  }, [includeWithdrawn, members, query])

  function selectMember(member: Member) {
    onChange(member.id)
    setQuery(memberLabel(member))
    setIsOpen(false)
  }

  function openOptions(resetActiveIndex = true) {
    setIsOpen(true)
    if (resetActiveIndex) {
      setActiveIndex(-1)
    }
  }

  return (
    <div className="searchable-member-select">
      <label htmlFor={inputId}>{label}</label>
      <div
        className={`member-autocomplete${isOpen ? ' is-open' : ''}`}
        ref={inputContainerRef}
      >
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
            openOptions()
          }}
          onFocus={() => openOptions()}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              openOptions(false)
              setActiveIndex((index) =>
                Math.min(index + 1, Math.max(visibleMembers.length - 1, 0)),
              )
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              openOptions(false)
              setActiveIndex((index) => Math.max(index - 1, 0))
            }
            if (
              event.key === 'Enter' &&
              isOpen &&
              visibleMembers[activeIndex]
            ) {
              event.preventDefault()
              selectMember(visibleMembers[activeIndex])
            }
            if (event.key === 'Escape') {
              setIsOpen(false)
            }
          }}
          placeholder="이름 또는 닉네임으로 검색"
          role="combobox"
          type="text"
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
        {isOpen && query.trim() !== '' &&
          createPortal(
            <div
              className="member-autocomplete-options member-autocomplete-options-floating"
              id={listboxId}
              ref={optionsRef}
              role="listbox"
              style={style}
            >
              <div className="floating-options-scroll">
                {visibleMembers.length === 0 ? (
                  <p>검색 결과가 없습니다.</p>
                ) : (
                  visibleMembers.map((member) => (
                    <button
                      aria-selected={member.id === value}
                      className={
                        member.id === value
                          ? 'is-selected'
                          : visibleMembers[activeIndex]?.id === member.id
                            ? 'is-active'
                            : undefined
                      }
                      key={member.id}
                      onMouseEnter={() =>
                        setActiveIndex(visibleMembers.indexOf(member))
                      }
                      onClick={() => selectMember(member)}
                      role="option"
                      type="button"
                    >
                      <strong>{member.displayName}</strong>
                      {member.externalNickname && (
                        <span>{member.externalNickname}</span>
                      )}
                      {member.membershipStatus === 'WITHDRAWN' && <em>탈퇴</em>}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
    </div>
  )
}
