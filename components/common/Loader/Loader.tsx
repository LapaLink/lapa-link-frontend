import { cn } from "cn"
import { Spinner } from "@/components/ui"

type LoaderProps = {
  label?: string
  className?: string
}

export function Loader({ label = "Загружаем…", className }: LoaderProps) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center justify-center gap-2 text-sm",
        className,
      )}
    >
      <Spinner aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
