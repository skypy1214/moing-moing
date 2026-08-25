import { useEffect, useId, useRef, useState } from 'react'
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

function isoDate(value: string) {
  const digits = dateDigits(value)
  if (digits.length !== 8) return null

  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function formatKoreanDate(value: string) {
  return displayDate(value)
}

export function KoreanDateInput({
  onChange,
  value,
  ...props
}: KoreanDateInputProps) {
  const calendarId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(() => displayDate(value))
  const [isOpen, setIsOpen] = useState(false)
  const initialDate =
    isoDate(value) ??
    formatIsoDate(new Date().getFullYear(), new Date().getMonth(), 1)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [year, month] = initialDate.split('-').map(Number)
    return { year, month: month - 1 }
  })

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A changed controlled value must replace the user-editable date draft.
    setDraft(displayDate(value))
  }, [value])

  function openCalendar() {
    const parsed = isoDate(value)
    if (parsed !== null) {
      const [year, month] = parsed.split('-').map(Number)
      setCalendarMonth({ year, month: month - 1 })
    }
    setIsOpen(true)
  }

  function selectDate(year: number, month: number, day: number) {
    const nextValue = formatIsoDate(year, month, day)
    setDraft(displayDate(nextValue))
    onChange(nextValue)
    setIsOpen(false)
  }

  const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1)
  const firstWeekday = firstDay.getDay()
  const numberOfDays = new Date(
    calendarMonth.year,
    calendarMonth.month + 1,
    0,
  ).getDate()
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      calendarMonth.year,
      calendarMonth.month,
      index - firstWeekday + 1,
    )
    return {
      day: date.getDate(),
      month: date.getMonth(),
      year: date.getFullYear(),
      isCurrentMonth:
        index >= firstWeekday && index < firstWeekday + numberOfDays,
    }
  })

  return (
    <div
      className="korean-date-input"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false)
        }
      }}
      ref={containerRef}
    >
      <input
        {...props}
        aria-controls={isOpen ? calendarId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={props['aria-label'] ?? '날짜'}
        inputMode="numeric"
        onChange={(event) => {
          const nextValue = displayDate(event.target.value)
          setDraft(nextValue)
          const parsed = isoDate(nextValue)
          event.currentTarget.setCustomValidity(
            parsed === null ? 'YYYY/MM/DD 형식으로 입력해 주세요.' : '',
          )
          if (parsed !== null) onChange(parsed)
        }}
        onClick={openCalendar}
        onFocus={openCalendar}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(
            'YYYY/MM/DD 형식으로 입력해 주세요.',
          )
        }}
        placeholder="YYYY/MM/DD"
        ref={inputRef}
        type="text"
        value={draft}
      />
      {isOpen && (
        <div
          aria-label="날짜 선택"
          className="date-picker-popover"
          id={calendarId}
          role="dialog"
        >
          <div className="date-picker-header">
            <button
              aria-label="이전 달"
              onClick={() =>
                setCalendarMonth((previous) => {
                  const date = new Date(previous.year, previous.month - 1, 1)
                  return { year: date.getFullYear(), month: date.getMonth() }
                })
              }
              type="button"
            >
              ‹
            </button>
            <strong>{`${calendarMonth.year}년 ${calendarMonth.month + 1}월`}</strong>
            <button
              aria-label="다음 달"
              onClick={() =>
                setCalendarMonth((previous) => {
                  const date = new Date(previous.year, previous.month + 1, 1)
                  return { year: date.getFullYear(), month: date.getMonth() }
                })
              }
              type="button"
            >
              ›
            </button>
          </div>
          <div aria-hidden="true" className="date-picker-weekdays">
            {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="date-picker-days">
            {calendarDays.map((date) => {
              const nextValue = formatIsoDate(date.year, date.month, date.day)
              return (
                <button
                  aria-label={`${date.year}년 ${date.month + 1}월 ${date.day}일`}
                  aria-pressed={value === nextValue}
                  className={`${date.isCurrentMonth ? '' : 'is-outside-month'}${value === nextValue ? ' is-selected' : ''}`}
                  key={nextValue}
                  onClick={() => selectDate(date.year, date.month, date.day)}
                  type="button"
                >
                  {date.day}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
