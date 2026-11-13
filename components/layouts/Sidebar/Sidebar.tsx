"use client"

import { usePathname } from "next/navigation"
import {
  CircleHelp,
  House,
  LifeBuoy,
  MessageCircle,
  Newspaper,
  PawPrint,
} from "lucide-react"
import { cn } from "cn"
import { NavigationLink as Link } from "@/components/providers"
import { NotificationCenter, UnreadCount } from "@/components/common"
import { useAuth, useChatUnreadCount } from "@/hooks"
import { ROUTES } from "@/lib/constants"

/**
 * Left navigation on wide screens: the main sections, plus messages and
 * notifications with their unread counts for signed-in users. Phones use the
 * bottom tab bar instead.
 */
export function Sidebar() {
  const pathname = usePathname() ?? ""
  const { user } = useAuth()
  const unread = useChatUnreadCount(!!user).data?.count ?? 0
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
            href: ROUTES.CHATS,
            label: "Сообщения",
            icon: MessageCircle,
            active: pathname.startsWith(ROUTES.CHATS),
            badge: unread,
          },
        ]
      : []),
  ]
  const rest = [
    {
      href: ROUTES.FAQ,
      label: "О проекте",
      icon: CircleHelp,
      active: pathname === ROUTES.FAQ,
    },
    {
      href: ROUTES.SUPPORT,
      label: "Поддержка",
      icon: LifeBuoy,
      active: pathname === ROUTES.SUPPORT,
    },
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
      {[...items, ...rest].map((item, index) => {
        const { href, label, icon: Icon, active } = item
        const badge = "badge" in item ? (item.badge ?? 0) : 0
        return (
          <div key={href} className="contents">
            {user && index === items.length && (
              <NotificationCenter variant="sidebar" />
            )}
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={row(active)}
            >
              <span className="relative">
                <Icon aria-hidden className="size-5" />
                <UnreadCount count={badge} />
              </span>
              {label}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
