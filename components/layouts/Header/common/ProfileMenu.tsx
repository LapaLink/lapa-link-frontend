"use client"

import { NavigationLink as Link } from "@/components/providers"
import { useRouter } from "next/navigation"
import {
  CircleHelp,
  LogOut,
  MessageCircle,
  UserRound,
  ChevronDown,
} from "lucide-react"
import { useChatUnreadCount, useLogout } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Loader, UserAvatar } from "@/components/common"
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui"
import type { CurrentUser } from "@/types"

export function ProfileMenu({ user }: { user: CurrentUser }) {
  const logout = useLogout()
  const router = useRouter()
  const unread = useChatUnreadCount().data?.count ?? 0
  async function signOut() {
    try {
      await logout.mutateAsync()
    } catch {
      // Logout clears the local session even when the backend is unavailable.
    } finally {
      router.replace(ROUTES.LOGIN)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          className="size-10 shrink-0 rounded-full p-0 sm:h-11 sm:w-auto sm:rounded-lg sm:px-3"
          disabled={logout.isPending}
          aria-label={`Меню профиля${unread ? `, непрочитанных сообщений: ${unread}` : ""}`}
        >
          <span className="relative shrink-0">
            <UserAvatar user={user} />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-card bg-primary"
              />
            )}
          </span>
          <span className="hidden max-w-40 truncate sm:inline">
            {user.displayName}
          </span>
          <ChevronDown data-icon="inline-end" className="hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate">{user.displayName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ROUTES.ACCOUNT}>
              <UserRound />
              Мой профиль
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ROUTES.CHATS}>
              <MessageCircle />
              Сообщения
              {unread > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[10px] font-bold leading-5 text-primary-foreground">
                  <span className="sr-only">, непрочитанных: </span>
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ROUTES.FAQ}>
              <CircleHelp />
              Частые вопросы
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            disabled={logout.isPending}
            className="min-h-11"
            onSelect={() => void signOut()}
          >
            {logout.isPending ? (
              <Loader label="Выходим…" />
            ) : (
              <>
                <LogOut />
                Выйти
              </>
            )}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
