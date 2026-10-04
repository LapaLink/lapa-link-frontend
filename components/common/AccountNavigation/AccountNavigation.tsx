"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useAuth, useLogout } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui"

export function AccountNavigation() {
  const { user, isLoading } = useAuth()
  const logout = useLogout()
  const router = useRouter()
  async function signOut() {
    try {
      await logout.mutateAsync()
    } catch {
      /* Logout always clears the local session, including on network failure. */
    } finally {
      router.replace(ROUTES.LOGIN)
    }
  }
  return (
    <nav aria-label="Аккаунт" className="flex flex-wrap items-center gap-3">
      {isLoading ? (
        <span role="status" className="text-sm text-muted-foreground">
          Загружаем профиль…
        </span>
      ) : user ? (
        <>
          <span className="max-w-40 truncate">{user.displayName}</span>
          <Button variant="outline" asChild>
            <Link href={ROUTES.ACCOUNT}>Мой профиль</Link>
          </Button>
          <Button disabled={logout.isPending} onClick={() => void signOut()}>
            {logout.isPending ? "Выходим…" : "Выйти"}
          </Button>
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
