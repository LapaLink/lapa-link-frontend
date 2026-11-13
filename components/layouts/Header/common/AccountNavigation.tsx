"use client"

import { NavigationLink as Link } from "@/components/providers"
import { MessageCircle, Plus } from "lucide-react"
import { usePathname } from "next/navigation"
import { useAuth, useChatUnreadCount } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button, Skeleton } from "@/components/ui"
import { ProfileMenu } from "./ProfileMenu"
import { NotificationCenter, UnreadCount } from "@/components/common"

export function AccountNavigation() {
  const { user, isLoading } = useAuth()
  const pathname = usePathname() ?? ""
  const inChat =
    pathname === ROUTES.CHATS || pathname.startsWith(`${ROUTES.CHATS}/`)
  const unread = useChatUnreadCount(!!user).data?.count ?? 0
  return (
    <nav
      aria-label="Аккаунт"
      className="flex shrink-0 items-center gap-1 sm:gap-3"
    >
      {isLoading ? (
        <span
          role="status"
          aria-label="Загружаем профиль…"
          className="flex items-center gap-3"
        >
          <span className="sr-only">Загружаем профиль…</span>
          <Skeleton aria-hidden="true" className="size-11 rounded-full" />
          <Skeleton aria-hidden="true" className="hidden h-6 w-28 sm:block" />
        </span>
      ) : user ? (
        <>
          <Button
            variant={inChat ? "secondary" : "ghost"}
            size="icon"
            className="hidden lg:inline-flex"
            asChild
          >
            <Link
              href={ROUTES.CHATS}
              aria-current={inChat ? "page" : undefined}
              aria-label={
                unread ? `Сообщения, непрочитанных: ${unread}` : "Сообщения"
              }
              title="Сообщения"
            >
              <span className="relative">
                <MessageCircle aria-hidden className="size-5" />
                <UnreadCount count={unread} />
              </span>
            </Link>
          </Button>
          <NotificationCenter key={user.id} />
          <ProfileMenu user={user} />
          <CreateCaseLink />
        </>
      ) : (
        <>
          <Button variant="outline" asChild>
            <Link href={ROUTES.LOGIN}>Войти</Link>
          </Button>
          <Button asChild>
            <Link href={ROUTES.REGISTER}>Регистрация</Link>
          </Button>
        </>
      )}
    </nav>
  )
}

/** The main action of the header on wide screens (phones have the round «+»). */
function CreateCaseLink() {
  return (
    <Button asChild className="hidden lg:inline-flex">
      <Link href={ROUTES.CREATE_CASE}>
        <Plus data-icon="inline-start" />
        Нашёл животное
      </Link>
    </Button>
  )
}
