import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import {
  FeedbackDialogContext,
  type ConfirmationDialogOptions,
  type FeedbackDialogOptions,
} from './feedback-dialog-context'
import { Modal } from '../ui/Modal'
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

  return (
    <FeedbackDialogContext.Provider value={{ confirm, showFeedbackDialog }}>
      {children}
      {dialog && (
        <Modal
          ariaLabelledBy="feedback-dialog-heading"
          className="modal-content feedback-dialog"
          footer={
            <button onClick={closeFeedbackDialog} type="button">
              확인
            </button>
          }
          onClose={closeFeedbackDialog}
        >
          <div className="modal-heading">
            <h2 id="feedback-dialog-heading">{dialog.title}</h2>
            <p>{dialog.message}</p>
          </div>
        </Modal>
      )}
      {confirmation && (
        <Modal
          ariaLabelledBy="confirmation-dialog-heading"
          className="modal-content feedback-dialog"
          footer={
            <>
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
            </>
          }
          onClose={() => closeConfirmation(false)}
          role="alertdialog"
        >
          <div className="modal-heading">
            <h2 id="confirmation-dialog-heading">{confirmation.title}</h2>
            <p>{confirmation.message}</p>
          </div>
        </Modal>
      )}
    </FeedbackDialogContext.Provider>
  )
}
