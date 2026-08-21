import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({
  className = '',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`ui-button ui-button-${variant} ${className}`}
    />
  )
}

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <section {...props} className={`ui-card ${className}`}>
      {children}
    </section>
  )
}

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: 'neutral' | 'primary' | 'success' | 'warning'
}

export function Chip({
  children,
  className = '',
  tone = 'neutral',
  ...props
}: ChipProps) {
  return (
    <span {...props} className={`ui-chip ui-chip-${tone} ${className}`}>
      {children}
    </span>
  )
}
