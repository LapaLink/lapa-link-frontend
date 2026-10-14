import type { ComponentType, ReactNode } from "react"
import { cn } from "cn"
import { Card, CardContent } from "@/components/ui"
import { IconCircle } from "../SectionCard/SectionCard"

/** Centered card for empty lists, load errors and sign-in prompts. */
export function EmptyState({
  icon,
  tone = "primary",
  title,
  titleAs: Title = "h2",
  description,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>
  tone?: "primary" | "danger"
  title: ReactNode
  titleAs?: "h1" | "h2" | "p"
  description?: ReactNode
  /** Alerts and actions under the text. */
  children?: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center gap-4 py-4 text-center sm:py-6">
        <IconCircle icon={icon} tone={tone} />
        <div className="flex max-w-md flex-col gap-1.5">
          <Title
            className={cn(
              "text-lg font-bold leading-snug",
              tone === "danger" && "text-destructive",
            )}
          >
            {title}
          </Title>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex w-full max-w-md flex-col items-stretch gap-3 empty:hidden sm:items-center">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
