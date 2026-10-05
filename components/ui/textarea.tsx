import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-28 w-full resize-none rounded-xl border border-primary/25 bg-primary/[0.03] px-4 py-3 text-base leading-relaxed shadow-xs transition-colors outline-none placeholder:text-muted-foreground/80 hover:border-primary/45 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
