import { useContext } from 'react'

import { FeedbackDialogContext } from './feedback-dialog-context'

export function useFeedbackDialog() {
  const context = useContext(FeedbackDialogContext)
  if (context === null) {
    throw new Error(
      'useFeedbackDialog must be used within FeedbackDialogProvider.',
    )
  }
  return context
}
