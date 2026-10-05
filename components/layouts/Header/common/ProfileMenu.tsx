"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LogOut, UserRound, ChevronDown, Plus } from "lucide-react"
import { useLogout } from "@/hooks"
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
          disabled={logout.isPending}
          aria-label="Меню профиля"
        >
          <UserAvatar user={user} />
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
            <Link href={ROUTES.CREATE_CASE}>
              <Plus />
              Создать объявление
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ROUTES.ACCOUNT}>
              <UserRound />
              Мой профиль
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
