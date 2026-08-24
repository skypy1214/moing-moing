type RefreshIconProps = {
  size?: number
}

export function RefreshIcon({ size = 18 }: RefreshIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="M20 11a8 8 0 0 0-14.9-4L3 10m0-5v5h5M4 13a8 8 0 0 0 14.9 4L21 14m0 5v-5h-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
