import type { ComponentType, ReactNode } from "react"
import { cn } from "cn"

const tones = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success text-success-foreground",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/10 text-destructive",
  urgent: "bg-urgent-soft text-urgent",
}

/** Small pill for a status or a short attribute; the text carries the meaning, the tone only supports it. */
export function StatusBadge({
  tone = "muted",
  icon: Icon,
  children,
  className,
}: {
  tone?: keyof typeof tones
  icon?: ComponentType<{ className?: string }>
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold [overflow-wrap:anywhere]",
        tones[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
      {children}
    </span>
  )
}
