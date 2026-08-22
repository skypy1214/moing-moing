import { useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type KoreanDateInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'type' | 'value'
> & {
  onChange: (value: string) => void
  value: string
}

function dateDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 8)
}

function displayDate(value: string) {
  const digits = dateDigits(value)
  return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)]
    .filter((part) => part.length > 0)
    .join('/')
}

function isoDate(digits: string) {
  if (digits.length !== 8) {
    return null
  }

  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

export function formatKoreanDate(value: string) {
  return displayDate(value)
}

export function KoreanDateInput({
  onChange,
  value,
  ...props
}: KoreanDateInputProps) {
  const [draft, setDraft] = useState(() => displayDate(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(displayDate(value))
  }, [value])

  function updateValidity(nextValue: string) {
    const input = inputRef.current
    if (input === null) {
      return
    }
    const parsed = isoDate(dateDigits(nextValue))
    input.setCustomValidity(
      parsed === null ? 'YYYY.MM.DD 형식으로 입력해 주세요.' : '',
    )
  }

  return (
    <input
      {...props}
      aria-label={props['aria-label'] ?? '날짜'}
      inputMode="numeric"
      onChange={(event) => {
        const nextValue = displayDate(event.target.value)
        setDraft(nextValue)
        updateValidity(nextValue)
        const parsed = isoDate(dateDigits(nextValue))
        if (parsed !== null) {
          onChange(parsed)
        }
      }}
      onInvalid={(event) => {
        event.currentTarget.setCustomValidity(
          'YYYY.MM.DD 형식으로 입력해 주세요.',
        )
      }}
      placeholder="YYYY/MM/DD"
      ref={inputRef}
      type="text"
      value={draft}
    />
  )
}
