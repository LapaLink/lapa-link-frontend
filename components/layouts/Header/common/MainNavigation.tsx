"use client"

import { usePathname } from "next/navigation"
import {
  ClipboardList,
  Menu,
  Newspaper,
  Plus,
  Search,
} from "lucide-react"
import { NavigationLink as Link } from "@/components/providers"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui"

const links = [
  { href: ROUTES.CASES, label: "Объявления", icon: Search },
  { href: ROUTES.CREATE_CASE, label: "Подать объявление", icon: Plus },
  { href: ROUTES.MY_CASES, label: "Мои объявления", icon: Newspaper },
  { href: ROUTES.MY_TASKS, label: "Мои задачи", icon: ClipboardList },
]

function isActive(pathname: string, href: string) {
  if (href === ROUTES.CASES)
    return (
      pathname === href ||
      (pathname.startsWith(`${href}/`) && pathname !== ROUTES.CREATE_CASE)
    )
  return pathname === href
}

/** Main site sections: inline links on wide screens, a menu button on phones. */
export function MainNavigation() {
  const pathname = usePathname() ?? ""
  return (
    <>
      <nav aria-label="Основное меню" className="hidden items-center gap-1 lg:flex">
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
            className="-order-1 lg:hidden"
            aria-label="Открыть меню"
          >
            <Menu />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64 max-w-[calc(100vw-2rem)]">
          {links.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href)
            return (
              <DropdownMenuItem
                key={href}
                asChild
                className={cn("min-h-11", active && "bg-secondary text-primary")}
              >
                <Link href={href} aria-current={active ? "page" : undefined}>
                  <Icon />
                  {label}
                </Link>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
