import { createContext } from 'react'

export type FeedbackDialogOptions = {
  title: string
  message: string
}

export type ConfirmationDialogOptions = FeedbackDialogOptions & {
  confirmLabel: string
  isDestructive?: boolean
}

export type FeedbackDialogContextValue = {
  showFeedbackDialog: (options: FeedbackDialogOptions) => void
  confirm: (options: ConfirmationDialogOptions) => Promise<boolean>
}

export const FeedbackDialogContext =
  createContext<FeedbackDialogContextValue | null>(null)
