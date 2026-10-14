import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { cn } from "cn"

/**
 * Page title block: an eyebrow (or a back link in its place), the title, an
 * optional description and actions that move to the right on wide screens.
 */
export function PageHeader({
  eyebrow,
  back,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  /** Back link shown instead of the eyebrow; `label` is the visible text. */
  back?: { href: string; label: string }
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col items-start gap-2">
        {back ? (
          <Link
            href={back.href}
            className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary outline-none transition-colors hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/40 sm:min-h-9"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        ) : (
          eyebrow && (
            <p className="text-sm font-semibold text-primary">{eyebrow}</p>
          )
        )}
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight [overflow-wrap:anywhere] sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">{actions}</div>
      )}
    </div>
  )
}
