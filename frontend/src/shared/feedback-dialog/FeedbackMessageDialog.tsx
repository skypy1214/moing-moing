import { Modal } from '../ui/Modal'

type FeedbackMessageDialogProps = {
  message: string
  onClose: () => void
}

export function FeedbackMessageDialog({
  message,
  onClose,
}: FeedbackMessageDialogProps) {
  return (
    <Modal
      ariaLabelledBy="feedback-message-heading"
      className="modal-content feedback-dialog"
      footer={
        <button onClick={onClose} type="button">
          확인
        </button>
      }
      onClose={onClose}
    >
      <div className="modal-heading">
        <h2 id="feedback-message-heading">알림</h2>
        <p>{message}</p>
      </div>
    </Modal>
  )
}
