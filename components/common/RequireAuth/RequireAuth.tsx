"use client"
import { LockKeyhole } from "lucide-react"
import { NavigationLink as Link } from "@/components/providers"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui"
import { FormAlert } from "../FormAlert/FormAlert"
import { PageLoader } from "../PageLoader/PageLoader"

type RequireAuthProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
  /** Explains to a guest why this page needs an account. */
  guestMessage?: string
}

/**
 * Renders children only for a signed-in user. Guests see an explanation
 * with sign-in and registration links instead of a silent redirect.
 */
export function RequireAuth({
  children,
  fallback,
  guestMessage = "Эта страница доступна после входа в аккаунт.",
}: RequireAuthProps) {
  const { user, isLoading, error, checkSession } = useAuth()
  if (isLoading)
    return fallback ?? <PageLoader label="Загружаем ваш профиль…" />
  if (error)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
        <FormAlert message={error.message} />
        <Button onClick={() => void checkSession()}>Попробовать ещё раз</Button>
      </div>
    )
  if (user) return children
  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border bg-card px-6 py-10 text-center shadow-sm sm:px-10">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <LockKeyhole className="size-6" aria-hidden />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Нужно войти</h1>
        <p className="text-muted-foreground">{guestMessage}</p>
      </div>
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href={ROUTES.LOGIN}>Войти</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={ROUTES.REGISTER}>Зарегистрироваться</Link>
        </Button>
      </div>
    </section>
  )
}
