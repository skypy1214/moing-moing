import { useEffect, useRef } from 'react'

const escapeKeyStack: symbol[] = []

export function useEscapeKey(onEscape: () => void, enabled = true) {
  const layerId = useRef(Symbol('escape-key-layer'))
  const onEscapeRef = useRef(onEscape)

  useEffect(() => {
    onEscapeRef.current = onEscape
  }, [onEscape])

  useEffect(() => {
    if (!enabled) {
      return
    }

    const registeredLayerId = layerId.current
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        escapeKeyStack[escapeKeyStack.length - 1] === registeredLayerId
      ) {
        event.preventDefault()
        onEscapeRef.current()
      }
    }
    escapeKeyStack.push(registeredLayerId)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      const index = escapeKeyStack.lastIndexOf(registeredLayerId)
      if (index >= 0) {
        escapeKeyStack.splice(index, 1)
      }
    }
  }, [enabled])
}
