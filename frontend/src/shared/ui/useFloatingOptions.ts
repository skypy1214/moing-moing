import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'

type UseFloatingOptionsParams = {
  anchorRef: RefObject<HTMLElement | null>
  isOpen: boolean
  onRequestClose: () => void
}

type FloatingOptions = {
  optionsRef: RefObject<HTMLDivElement | null>
  style: CSSProperties
}

/**
 * Renders option lists in a portal so scrollable Dialog and Bottom Sheet
 * containers cannot clip them. The position is recalculated on scroll/resize.
 */
export function useFloatingOptions({
  anchorRef,
  isOpen,
  onRequestClose,
}: UseFloatingOptionsParams): FloatingOptions {
  const optionsRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties>({})

  useLayoutEffect(() => {
    if (!isOpen || anchorRef.current === null) {
      return
    }

    function updatePosition() {
      const anchor = anchorRef.current
      if (anchor === null) return

      const rect = anchor.getBoundingClientRect()
      const viewportPadding = 8
      const below = window.innerHeight - rect.bottom - viewportPadding
      const above = rect.top - viewportPadding
      const contentHeight = Math.min(
        296,
        Math.max(44, optionsRef.current?.scrollHeight ?? 104),
      )
      const preferredHeight = Math.max(104, contentHeight)
      const opensUpward = below < preferredHeight && above > below
      const availableHeight = Math.max(
        44,
        Math.min(preferredHeight, opensUpward ? above : below),
      )

      setStyle({
        height: availableHeight,
        left: window.scrollX + Math.max(viewportPadding, rect.left),
        maxHeight: availableHeight,
        top: opensUpward
          ? window.scrollY +
            Math.max(viewportPadding, rect.top - availableHeight)
          : window.scrollY + rect.bottom,
        width: Math.min(
          rect.width,
          window.innerWidth - rect.left - viewportPadding,
        ),
      })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, isOpen])

  useEffect(() => {
    if (!isOpen) return

    function closeWhenClickedOutside(event: PointerEvent) {
      const target = event.target as Node
      if (
        anchorRef.current?.contains(target) ||
        optionsRef.current?.contains(target)
      ) {
        return
      }
      onRequestClose()
    }

    document.addEventListener('pointerdown', closeWhenClickedOutside)
    return () =>
      document.removeEventListener('pointerdown', closeWhenClickedOutside)
  }, [anchorRef, isOpen, onRequestClose])

  return { optionsRef, style }
}
