import Link from "next/link"
import { ROUTES } from "@/lib/constants"

export function Footer() {
  return (
    <footer className="border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm sm:px-6 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-bold text-foreground">LapaLink</span>
          <span aria-hidden className="mx-1.5 text-primary">
            ♥
          </span>
          Добрые дела рядом
        </p>
        <Link
          href={ROUTES.FAQ}
          className="font-medium text-foreground/80 hover:text-primary hover:underline"
        >
          Частые вопросы
        </Link>
      </div>
    </footer>
  )
}
