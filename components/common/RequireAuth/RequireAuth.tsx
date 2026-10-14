"use client"
import { CloudOff, LockKeyhole } from "lucide-react"
import { NavigationLink as Link } from "@/components/providers"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui"
import { EmptyState } from "../EmptyState/EmptyState"
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
      <EmptyState
        className="mx-auto w-full max-w-md"
        icon={CloudOff}
        titleAs="h1"
        title="Не получилось проверить вход"
      >
        <FormAlert message={error.message} />
        <Button className="h-11 sm:h-10" onClick={() => void checkSession()}>
          Попробовать ещё раз
        </Button>
      </EmptyState>
    )
  if (user) return children
  return (
    <EmptyState
      className="mx-auto w-full max-w-md"
      icon={LockKeyhole}
      titleAs="h1"
      title="Нужно войти"
      description={guestMessage}
    >
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild size="lg">
          <Link href={ROUTES.LOGIN}>Войти</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href={ROUTES.REGISTER}>Зарегистрироваться</Link>
        </Button>
      </div>
    </EmptyState>
  )
}
