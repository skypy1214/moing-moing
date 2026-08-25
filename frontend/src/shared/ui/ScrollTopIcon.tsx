type ScrollTopIconProps = {
  size?: number
}

export function ScrollTopIcon({ size = 20 }: ScrollTopIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d="m6 14 6-6 6 6M12 8v10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}
