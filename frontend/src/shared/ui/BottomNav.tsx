import type { CSSProperties } from 'react'

export type BottomNavItem<T extends string> = {
  icon: string
  label: string
  value: T
}

type BottomNavProps<T extends string> = {
  active: T
  items: BottomNavItem<T>[]
  onChange: (value: T) => void
}

export function BottomNav<T extends string>({
  active,
  items,
  onChange,
}: BottomNavProps<T>) {
  const activeIndex = items.findIndex((item) => item.value === active)

  return (
    <nav
      aria-label="주요 메뉴"
      className="bottom-navigation"
      style={{ '--active-index': activeIndex } as CSSProperties}
    >
      <span aria-hidden="true" className="bottom-navigation-indicator" />
      {items.map((item) => {
        const isActive = item.value === active
        return (
          <button
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'bottom-navigation-item is-active'
                : 'bottom-navigation-item'
            }
            key={item.value}
            onClick={() => onChange(item.value)}
            type="button"
          >
            <span aria-hidden="true" className="bottom-navigation-icon">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
