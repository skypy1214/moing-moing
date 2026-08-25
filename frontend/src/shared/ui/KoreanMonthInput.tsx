import { useEffect, useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type KoreanMonthInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'type' | 'value'
> & {
  onChange: (value: string) => void
  value: string
}

function monthDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 6)
}

function displayMonth(value: string) {
  const digits = monthDigits(value)
  return [digits.slice(0, 4), digits.slice(4, 6)]
    .filter((part) => part.length > 0)
    .join('/')
}

function isoMonth(value: string) {
  const digits = monthDigits(value)
  if (digits.length !== 6) return null

  const month = Number(digits.slice(4, 6))
  if (month < 1 || month > 12) return null

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`
}

export function KoreanMonthInput({
  onChange,
  value,
  ...props
}: KoreanMonthInputProps) {
  const pickerId = useId()
  const [draft, setDraft] = useState(() => displayMonth(value))
  const [isOpen, setIsOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(
    () => Number(value.slice(0, 4)) || new Date().getFullYear(),
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- A changed controlled value must replace the user-editable month draft.
    setDraft(displayMonth(value))
  }, [value])

  function openPicker() {
    const parsed = isoMonth(value)
    if (parsed !== null) setPickerYear(Number(parsed.slice(0, 4)))
    setIsOpen(true)
  }

  function selectMonth(month: number) {
    const nextValue = `${pickerYear}-${String(month).padStart(2, '0')}`
    setDraft(displayMonth(nextValue))
    onChange(nextValue)
    setIsOpen(false)
  }

  return (
    <div
      className="korean-date-input"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false)
      }}
    >
      <input
        {...props}
        aria-controls={isOpen ? pickerId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        inputMode="numeric"
        onChange={(event) => {
          const nextValue = displayMonth(event.target.value)
          setDraft(nextValue)
          const parsed = isoMonth(nextValue)
          event.currentTarget.setCustomValidity(
            parsed === null ? 'YYYY/MM 형식으로 입력해 주세요.' : '',
          )
          if (parsed !== null) onChange(parsed)
        }}
        onClick={openPicker}
        onFocus={openPicker}
        onInvalid={(event) => {
          event.currentTarget.setCustomValidity(
            'YYYY/MM 형식으로 입력해 주세요.',
          )
        }}
        placeholder="YYYY/MM"
        type="text"
        value={draft}
      />
      {isOpen && (
        <div
          aria-label="월 선택"
          className="date-picker-popover month-picker-popover"
          id={pickerId}
          role="dialog"
        >
          <div className="date-picker-header">
            <button
              aria-label="이전 연도"
              onClick={() => setPickerYear((year) => year - 1)}
              type="button"
            >
              ‹
            </button>
            <strong>{`${pickerYear}년`}</strong>
            <button
              aria-label="다음 연도"
              onClick={() => setPickerYear((year) => year + 1)}
              type="button"
            >
              ›
            </button>
          </div>
          <div className="month-picker-months">
            {Array.from({ length: 12 }, (_, index) => index + 1).map(
              (pickerMonth) => {
                const nextValue = `${pickerYear}-${String(pickerMonth).padStart(2, '0')}`
                return (
                  <button
                    aria-pressed={value === nextValue}
                    className={value === nextValue ? 'is-selected' : undefined}
                    key={pickerMonth}
                    onClick={() => selectMonth(pickerMonth)}
                    type="button"
                  >
                    {`${pickerMonth}월`}
                  </button>
                )
              },
            )}
          </div>
        </div>
      )}
    </div>
  )
}
