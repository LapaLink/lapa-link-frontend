import type { ReactNode } from "react"
import Link from "next/link"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui"
import { AccountNavigation, Brand } from "./common"

type HeaderProps = { children?: ReactNode }

export function Header({ children }: HeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Brand />
          <nav className="hidden items-center gap-2 sm:flex">
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.CASES}>Объявления</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.CREATE_CASE}>Подать объявление</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.MY_TASKS}>Мои задачи</Link>
            </Button>
          </nav>
        </div>
        {children ?? <AccountNavigation />}
      </div>
    </header>
  )
}
