type SettingsIconProps = {
  size?: number
}

export function SettingsIcon({ size = 19 }: SettingsIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M19.1 13.5a7.5 7.5 0 0 0 .04-3l1.66-1.29-1.9-3.29-1.98.8a7.75 7.75 0 0 0-2.59-1.5L14 3.1h-3.8l-.33 2.12a7.75 7.75 0 0 0-2.59 1.5l-1.98-.8-1.9 3.29 1.66 1.29a7.5 7.5 0 0 0 .04 3L3.4 14.79l1.9 3.29 1.98-.8a7.75 7.75 0 0 0 2.59 1.5L10.2 20.9H14l.33-2.12a7.75 7.75 0 0 0 2.59-1.5l1.98.8 1.9-3.29-1.7-1.29Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}
