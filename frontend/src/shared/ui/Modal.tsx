import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { useEscapeKey } from './useEscapeKey'

type ModalProps = {
  ariaLabelledBy?: string
  children: ReactNode
  className?: string
  closeOnEscape?: boolean
  closeLabel?: string
  footer?: ReactNode
  onClose: () => void
  role?: 'dialog' | 'alertdialog'
}

export function Modal({
  ariaLabelledBy,
  children,
  className,
  closeOnEscape = true,
  closeLabel = '모달 닫기',
  footer,
  onClose,
  role = 'dialog',
}: ModalProps) {
  const modalRef = useRef<HTMLElement>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  useEscapeKey(onClose, closeOnEscape)

  useEffect(() => {
    previouslyFocusedElement.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const modal = modalRef.current
    const focusTarget = modal?.querySelector<HTMLElement>(
      '[data-modal-autofocus]',
    )
    ;(focusTarget ?? modal)?.focus()

    return () => previouslyFocusedElement.current?.focus()
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section
        aria-labelledby={ariaLabelledBy}
        aria-modal="true"
        className={className ?? 'modal-content'}
        ref={modalRef}
        role={role}
        tabIndex={-1}
      >
        <div className="modal-scroll-content">
          <div className="modal-header">
            <button
              aria-label={closeLabel}
              className="modal-close-button"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
          {children}
        </div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  )
}
