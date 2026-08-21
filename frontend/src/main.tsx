import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { FeedbackDialogProvider } from './shared/feedback-dialog/FeedbackDialogProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FeedbackDialogProvider>
      <App />
    </FeedbackDialogProvider>
  </StrictMode>,
)
