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
  useEscapeKey(onClose, closeOnEscape)

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
        role={role}
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
