import type { ReactNode } from "react"
import { AccountNavigation, Brand, MainNavigation } from "./common"

type HeaderProps = { children?: ReactNode }

export function Header({ children }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur lg:static">
      <div className="mx-auto flex w-full max-w-[100rem] items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-6">
          <Brand />
          {!children && <MainNavigation />}
        </div>
        {children ?? <AccountNavigation />}
      </div>
    </header>
  )
}
