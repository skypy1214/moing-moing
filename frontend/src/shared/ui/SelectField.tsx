import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useFloatingOptions } from './useFloatingOptions'

export type SelectOption = {
  label: string
  value: string
}

type SelectFieldProps = {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  value: string
}

export function SelectField({
  disabled = false,
  label,
  onChange,
  options,
  placeholder = '선택',
  value,
}: SelectFieldProps) {
  const listboxId = useId()
  const fieldRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value)
  const { optionsRef, style } = useFloatingOptions({
    anchorRef: fieldRef,
    isOpen,
    onRequestClose: () => setIsOpen(false),
  })

  return (
    <div
      className={`ui-select-field${isOpen ? ' is-open' : ''}`}
      ref={fieldRef}
    >
      <span className="ui-select-label">{label}</span>
      <button
        aria-controls={listboxId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="ui-select-trigger"
        disabled={disabled}
        onClick={() => setIsOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setIsOpen(false)
          }
        }}
        role="combobox"
        type="button"
      >
        <span>{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true" className="ui-select-chevron">
          ▾
        </span>
      </button>
      {isOpen &&
        createPortal(
          <div
            className="ui-select-options ui-select-options-floating"
            id={listboxId}
            ref={optionsRef}
            role="listbox"
            style={style}
          >
            <div className="floating-options-scroll">
              {options.map((option) => (
                <button
                  aria-selected={option.value === value}
                  className={option.value === value ? 'is-selected' : undefined}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  role="option"
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
