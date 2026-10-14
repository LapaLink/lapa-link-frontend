import type { ComponentType, ReactNode } from "react"
import { cn } from "cn"
import { Card, CardContent } from "@/components/ui"

type Icon = ComponentType<{ className?: string }>

const circleTones = {
  primary: "bg-primary-soft text-primary",
  muted: "bg-muted text-foreground/70",
  danger: "bg-destructive/10 text-destructive",
}

/** Decorative icon in a soft round badge, used next to card and field titles. */
export function IconCircle({
  icon: Icon,
  tone = "primary",
  size = "default",
}: {
  icon: Icon
  tone?: keyof typeof circleTones
  size?: "default" | "sm"
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        circleTones[tone],
        size === "sm" ? "size-9" : "size-10 sm:size-12",
      )}
    >
      <Icon className={size === "sm" ? "size-4" : "size-5"} />
    </span>
  )
}

/**
 * Card with an icon, a title, an optional description and an optional action
 * (e.g. a switch) on the right. The body sits under the title on wide screens
 * (or spans the card with `fullWidthBody`) and takes the full card width on phones.
 */
export function SectionCard({
  icon,
  title,
  titleId,
  description,
  descriptionId,
  action,
  children,
  className,
  tone = "primary",
  fullWidthBody = false,
}: {
  icon: Icon
  title: ReactNode
  titleId?: string
  description?: ReactNode
  descriptionId?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
  tone?: "primary" | "danger"
  fullWidthBody?: boolean
}) {
  return (
    <Card className={className}>
      <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 sm:gap-x-4">
        <span className={cn("flex", description && "sm:row-span-2")}>
          <IconCircle icon={icon} tone={tone} />
        </span>
        <h2
          id={titleId}
          className={cn(
            "min-w-0 self-center text-base font-bold leading-snug sm:text-lg",
            description && "sm:self-end",
            !action && "col-span-2",
            tone === "danger" && "text-destructive",
          )}
        >
          {title}
        </h2>
        {action && (
          <div
            className={cn(
              "shrink-0 self-center",
              description && "sm:row-span-2",
            )}
          >
            {action}
          </div>
        )}
        {description && (
          <div
            id={descriptionId}
            className={cn(
              "col-span-3 mt-1 text-sm text-muted-foreground sm:col-span-1 sm:col-start-2 sm:mt-0",
              !action && "sm:col-span-2",
            )}
          >
            {description}
          </div>
        )}
        {children && (
          <div
            className={cn(
              "col-span-3 mt-3 flex min-w-0 flex-col gap-4 empty:hidden",
              !fullWidthBody && "sm:col-span-2 sm:col-start-2",
            )}
          >
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
