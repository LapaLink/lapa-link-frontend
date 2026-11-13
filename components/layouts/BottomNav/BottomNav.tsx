"use client"

import { usePathname } from "next/navigation"
import {
  LogIn,
  Plus,
  MessageCircle,
  Newspaper,
  Search,
  UserRound,
} from "lucide-react"
import { cn } from "cn"
import { NavigationLink as Link } from "@/components/providers"
import { UnreadCount } from "@/components/common"
import { useAuth, useChatUnreadCount } from "@/hooks"
import { ROUTES } from "@/lib/constants"

/**
 * Tab bar at the bottom of the screen on phones and tablets: search, own
 * cases, a round «+» in the middle (the main action: report an animal),
 * messages with the unread count and the profile (sign in for guests).
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
    /** The raised round main action. */
    center?: boolean
  }> = [
    {
      href: ROUTES.CASES,
      label: "Поиск",
      icon: Search,
      active:
        pathname === ROUTES.CASES ||
        (pathname.startsWith(`${ROUTES.CASES}/`) &&
          pathname !== ROUTES.CREATE_CASE),
    },
    {
      // Guests land on the page's own sign-in prompt.
      href: ROUTES.MY_CASES,
      label: "Мои объявления",
      icon: Newspaper,
      active: pathname === ROUTES.MY_CASES,
    },
    {
      href: ROUTES.CREATE_CASE,
      label: "Создать объявление",
      icon: Plus,
      active: pathname === ROUTES.CREATE_CASE,
      center: true,
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
        {tabs.map(({ href, label, icon: Icon, active, badge = 0, center }) => {
          if (center)
            return (
              <li key={href} className="flex flex-1 justify-center">
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className="-mt-5 flex size-14 items-center justify-center self-start rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-card outline-none transition-colors hover:bg-primary-hover focus-visible:ring-ring"
                >
                  <Icon aria-hidden className="size-7" strokeWidth={2.5} />
                </Link>
              </li>
            )
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={badge > 0 ? `${label}, непрочитанных: ${badge}` : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold outline-none transition-colors focus-visible:bg-muted",
                  active
                    ? "text-primary"
                    : "text-foreground/60 hover:text-foreground",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-6" />
                  <UnreadCount count={badge} />
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
