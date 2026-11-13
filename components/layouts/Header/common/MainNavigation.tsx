"use client"

import { Plus, Search } from "lucide-react"
import { usePathname } from "next/navigation"
import { NavigationLink as Link } from "@/components/providers"
import { Button } from "@/components/ui"
import { ROUTES } from "@/lib/constants"

export function MainNavigation() {
  const pathname = usePathname() ?? ""
  const creating = pathname === ROUTES.CREATE_CASE
  const browsing =
    pathname === ROUTES.CASES ||
    (pathname.startsWith(`${ROUTES.CASES}/`) && !creating)

  return (
    <nav
      aria-label="Основное меню"
      className="hidden items-center gap-2 lg:flex"
    >
      <Button variant={browsing ? "secondary" : "ghost"} asChild>
        <Link href={ROUTES.CASES} aria-current={browsing ? "page" : undefined}>
          <Search data-icon="inline-start" />
          Объявления
        </Link>
      </Button>
      <Button asChild>
        <Link
          href={ROUTES.CREATE_CASE}
          aria-current={creating ? "page" : undefined}
        >
          <Plus data-icon="inline-start" />
          Создать объявление
        </Link>
      </Button>
    </nav>
  )
}
