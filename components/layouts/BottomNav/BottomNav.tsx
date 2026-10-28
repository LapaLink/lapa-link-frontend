"use client"

import { usePathname } from "next/navigation"
import {
  CirclePlus,
  LogIn,
  MessageCircle,
  Search,
  UserRound,
} from "lucide-react"
import { cn } from "cn"
import { NavigationLink as Link } from "@/components/providers"
import { useAuth, useChatUnreadCount } from "@/hooks"
import { ROUTES } from "@/lib/constants"

/**
 * Tab bar at the bottom of the screen on phones and tablets: cases, a new
 * case, messages with the unread count and the profile (sign in for guests).
 */
export function BottomNav() {
  const pathname = usePathname() ?? ""
  const { user, isLoading } = useAuth()
  const unread = useChatUnreadCount(!!user).data?.count ?? 0
  const tabs: Array<{
    href: string
    label: string
    icon: typeof Search
    active: boolean
    badge?: number
  }> = [
    {
      href: ROUTES.CASES,
      label: "Объявления",
      icon: Search,
      active:
        pathname === ROUTES.CASES ||
        (pathname.startsWith(`${ROUTES.CASES}/`) &&
          pathname !== ROUTES.CREATE_CASE),
    },
    {
      href: ROUTES.CREATE_CASE,
      label: "Подать",
      icon: CirclePlus,
      active: pathname === ROUTES.CREATE_CASE,
    },
    ...(user
      ? [
          {
            href: ROUTES.CHATS,
            label: "Сообщения",
            icon: MessageCircle,
            active: pathname.startsWith(ROUTES.CHATS),
            badge: unread,
          },
          {
            href: ROUTES.ACCOUNT,
            label: "Профиль",
            icon: UserRound,
            active: pathname === ROUTES.ACCOUNT,
          },
        ]
      : isLoading
        ? []
        : [
            {
              href: ROUTES.LOGIN,
              label: "Войти",
              icon: LogIn,
              active: pathname === ROUTES.LOGIN,
            },
          ]),
  ]

  return (
    <nav
      aria-label="Быстрое меню"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-foreground/[0.07] bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {tabs.map(({ href, label, icon: Icon, active, badge = 0 }) => {
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold outline-none transition-colors focus-visible:bg-muted",
                  active
                    ? "text-primary"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-primary-foreground">
                      <span className="sr-only">, непрочитанных: </span>
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
