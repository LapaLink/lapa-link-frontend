import type { ReactNode } from "react"
import { AccountNavigation, Brand, MainNavigation } from "./common"

type HeaderProps = { children?: ReactNode }

export function Header({ children }: HeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-3">
          <Brand />
          <MainNavigation />
        </div>
        {children ?? <AccountNavigation />}
      </div>
    </header>
  )
}
