"use client"

import { usePathname } from "next/navigation"
import { ClipboardList, Menu, Newspaper, Plus, Search } from "lucide-react"
import { NavigationLink as Link } from "@/components/providers"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"

const allLinks = [
  { href: ROUTES.CASES, label: "Объявления", icon: Search },
  { href: ROUTES.CREATE_CASE, label: "Подать объявление", icon: Plus },
  {
    href: ROUTES.MY_CASES,
    label: "Мои объявления",
    icon: Newspaper,
    private: true,
  },
  {
    href: ROUTES.MY_TASKS,
    label: "Мои отклики",
    icon: ClipboardList,
    private: true,
  },
]

function isActive(pathname: string, href: string) {
  if (href === ROUTES.CASES)
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && pathname !== ROUTES.CREATE_CASE)
    )
  return pathname === href
}

/** Main site sections: inline links on wide screens, a menu button on phones. Personal ones only for signed-in users. */
export function MainNavigation() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()
  // Personal sections are hidden from guests (and while the session loads).
  const links = user ? allLinks : allLinks.filter((link) => !link.private)
  return (
    <>
      <nav
        aria-label="Основное меню"
        className="hidden items-center gap-1 lg:flex"
      >
        {links.map(({ href, label }) => {
          const active = isActive(pathname, href)
          return (
            <Button
              key={href}
              variant="ghost"
              size="sm"
              asChild
              className={cn(active && "bg-secondary text-primary")}
            >
              <Link href={href} aria-current={active ? "page" : undefined}>
                {label}
              </Link>
            </Button>
          )
        })}
      </nav>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            className="-order-1 size-10 shrink-0 lg:hidden"
            aria-label="Открыть меню"
          >
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64 max-w-[calc(100vw-2rem)]"
        >
          <DropdownMenuGroup>
            {links.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href)
              return (
                <DropdownMenuItem
                  key={href}
                  asChild
                  className={cn(
                    "min-h-11",
                    active && "bg-secondary text-primary",
                  )}
                >
                  <Link href={href} aria-current={active ? "page" : undefined}>
                    <Icon />
                    {label}
                  </Link>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
