import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  FeedbackDialogContext,
  type ConfirmationDialogOptions,
  type FeedbackDialogOptions,
} from './feedback-dialog-context'
import './feedback-dialog.css'

export function FeedbackDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<FeedbackDialogOptions | null>(null)
  const [confirmation, setConfirmation] =
    useState<ConfirmationDialogOptions | null>(null)
  const confirmationResolver = useRef<((confirmed: boolean) => void) | null>(
    null,
  )
  const closeFeedbackDialog = useCallback(() => setDialog(null), [])
  const showFeedbackDialog = useCallback(
    (options: FeedbackDialogOptions) => setDialog(options),
    [],
  )
  const confirm = useCallback((options: ConfirmationDialogOptions) => {
    setConfirmation(options)
    return new Promise<boolean>((resolve) => {
      confirmationResolver.current = resolve
    })
  }, [])
  const closeConfirmation = useCallback((confirmed: boolean) => {
    confirmationResolver.current?.(confirmed)
    confirmationResolver.current = null
    setConfirmation(null)
  }, [])

  useEffect(() => {
    if (dialog === null && confirmation === null) {
      return
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (confirmation !== null) {
          closeConfirmation(false)
          return
        }
        closeFeedbackDialog()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [closeConfirmation, closeFeedbackDialog, confirmation, dialog])

  return (
    <FeedbackDialogContext.Provider value={{ confirm, showFeedbackDialog }}>
      {children}
      {dialog && (
        <div
          className="feedback-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeFeedbackDialog()
            }
          }}
        >
          <section
            aria-labelledby="feedback-dialog-heading"
            aria-modal="true"
            className="feedback-dialog"
            role="dialog"
          >
            <h2 id="feedback-dialog-heading">{dialog.title}</h2>
            <p>{dialog.message}</p>
            <div className="feedback-dialog-actions">
              <button onClick={closeFeedbackDialog} type="button">
                확인
              </button>
            </div>
          </section>
        </div>
      )}
      {confirmation && (
        <div
          className="feedback-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmation(false)
            }
          }}
        >
          <section
            aria-labelledby="confirmation-dialog-heading"
            aria-modal="true"
            className="feedback-dialog"
            role="alertdialog"
          >
            <h2 id="confirmation-dialog-heading">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
            <div className="feedback-dialog-actions">
              <button
                className="feedback-dialog-cancel"
                onClick={() => closeConfirmation(false)}
                type="button"
              >
                취소
              </button>
              <button
                className={confirmation.isDestructive ? 'danger-button' : ''}
                onClick={() => closeConfirmation(true)}
                type="button"
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}
    </FeedbackDialogContext.Provider>
  )
}
