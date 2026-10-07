"use client"

import { NavigationLink as Link } from "@/components/providers"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button, Skeleton } from "@/components/ui"
import { ProfileMenu } from "./ProfileMenu"

export function AccountNavigation() {
  const { user, isLoading } = useAuth()
  return (
    <nav aria-label="Аккаунт" className="flex flex-wrap items-center gap-3">
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
        <ProfileMenu user={user} />
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
