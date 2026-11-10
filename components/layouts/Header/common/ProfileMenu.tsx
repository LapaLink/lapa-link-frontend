"use client"

import { NavigationLink as Link } from "@/components/providers"
import { usePathname, useRouter } from "next/navigation"
import {
  ChevronDown,
  CircleHelp,
  ClipboardList,
  House,
  LifeBuoy,
  LogOut,
  Newspaper,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { useLogout } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { cn } from "@/lib/utils"
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
import { canModerate } from "@/lib/moderation"

const activityLinks = [
  { href: ROUTES.MY_CASES, label: "Мои объявления", icon: Newspaper },
  { href: ROUTES.MY_TASKS, label: "Мои отклики", icon: ClipboardList },
  { href: ROUTES.MY_ADOPTIONS, label: "Заявки на дом", icon: House },
]

export function ProfileMenu({ user }: { user: CurrentUser }) {
  const logout = useLogout()
  const router = useRouter()
  const pathname = usePathname()
  const inProfile = pathname === ROUTES.ACCOUNT
  const inActivity = activityLinks.some(({ href }) => pathname === href)
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
          variant={inProfile || inActivity ? "secondary" : "ghost"}
          size="lg"
          className="size-10 shrink-0 rounded-full p-0 sm:h-11 sm:w-auto sm:rounded-lg sm:px-3"
          disabled={logout.isPending}
          aria-label="Меню профиля"
        >
          <UserAvatar user={user} />
          <span className="hidden max-w-36 truncate sm:inline">
            {user.displayName}
          </span>
          <ChevronDown data-icon="inline-end" className="hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 max-w-[calc(100vw-2rem)]"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate">{user.displayName}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">
              {user.email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuItem
            asChild
            className={cn("min-h-11", inProfile && "bg-secondary text-primary")}
          >
            <Link
              href={ROUTES.ACCOUNT}
              aria-current={inProfile ? "page" : undefined}
            >
              <UserRound />
              Мой профиль
            </Link>
          </DropdownMenuItem>
          {canModerate(user) && (
            <DropdownMenuItem asChild className="min-h-11">
              <Link href={ROUTES.MODERATION_REPORTS}>
                <ShieldCheck />
                Модерация жалоб
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="Моя активность">
          <DropdownMenuLabel>Моя активность</DropdownMenuLabel>
          {activityLinks.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
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
        <DropdownMenuSeparator />
        <DropdownMenuGroup aria-label="Помощь">
          <DropdownMenuLabel>Помощь</DropdownMenuLabel>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ROUTES.FAQ}>
              <CircleHelp />
              Частые вопросы
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={ROUTES.SUPPORT}>
              <LifeBuoy />
              Связаться с администратором
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
