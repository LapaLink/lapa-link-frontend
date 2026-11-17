"use client"

import { usePathname } from "next/navigation"
import { Heart, House, Newspaper, PawPrint } from "lucide-react"
import { cn } from "cn"
import { NavigationLink as Link } from "@/components/providers"
import { useApplyPendingFavorite, useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"

/**
 * Left navigation on wide screens: the main sections, plus own cases and
 * favorites for signed-in users. Phones use the bottom tab bar instead.
 */
export function Sidebar() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()
  useApplyPendingFavorite()
  const items = [
    {
      href: ROUTES.HOME,
      label: "Главная",
      icon: House,
      active: pathname === ROUTES.HOME,
    },
    {
      href: ROUTES.CASES,
      label: "Объявления",
      icon: PawPrint,
      active:
        pathname.startsWith(ROUTES.CASES) && pathname !== ROUTES.CREATE_CASE,
    },
    ...(user
      ? [
          {
            href: ROUTES.MY_CASES,
            label: "Мои объявления",
            icon: Newspaper,
            active: pathname === ROUTES.MY_CASES,
          },
          {
            href: ROUTES.FAVORITES,
            label: "Избранное",
            icon: Heart,
            active: pathname === ROUTES.FAVORITES,
          },
        ]
      : []),
  ]
  const row = (active: boolean) =>
    cn(
      "flex h-12 items-center gap-3 rounded-xl px-4 text-base font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
      active
        ? "bg-primary-soft text-primary"
        : "text-foreground/80 hover:bg-muted hover:text-foreground",
    )
  return (
    <nav
      aria-label="Разделы"
      className="sticky top-6 hidden w-56 shrink-0 self-start py-10 lg:flex lg:flex-col lg:gap-1"
    >
      {items.map((item) => {
        const { href, label, icon: Icon, active } = item
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={row(active)}
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
