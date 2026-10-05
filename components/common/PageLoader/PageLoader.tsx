import { PawPrint } from "lucide-react"
import { cn } from "cn"
import { Loader } from "../Loader/Loader"

type PageLoaderProps = {
  label?: string
  className?: string
}

export function PageLoader({
  label = "Загружаем страницу…",
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn(
        "flex min-h-[60svh] flex-1 flex-col items-center justify-center gap-6 px-6 py-12",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary motion-safe:animate-pulse"
      >
        <PawPrint className="size-10" strokeWidth={1.5} />
      </div>
      <Loader label={label} className="text-muted-foreground" />
    </div>
  )
}
