import type { ComponentType, ReactNode } from "react"
import { cn } from "cn"

/**
 * One line of a settings list: an icon, a title and a hint on the left, the
 * control on the right (under the text on phones). `danger` tints the line.
 */
export function SettingRow({
  icon: Icon,
  title,
  description,
  children,
  tone = "default",
}: {
  icon: ComponentType<{ className?: string }>
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  tone?: "default" | "danger"
}) {
  const danger = tone === "danger"
  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        danger &&
          "my-3 rounded-xl border border-destructive/20 bg-destructive/[0.04] px-4",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          aria-hidden
          className={cn(
            "mt-0.5 size-5 shrink-0",
            danger ? "text-destructive" : "text-foreground/60",
          )}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn("font-semibold", danger && "text-destructive")}>
            {title}
          </p>
          {description && (
            <div className="text-sm text-foreground/70 [overflow-wrap:anywhere]">
              {description}
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-start sm:items-end">
        {children}
      </div>
    </div>
  )
}
