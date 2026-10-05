"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui"
import { FormAlert, PageLoader } from "@/components/common"

type RequireAuthProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, isLoading, error, checkSession } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!isLoading && !user && !error) router.replace(ROUTES.LOGIN)
  }, [user, isLoading, error, router])
  if (isLoading)
    return fallback ?? <PageLoader label="Загружаем ваш профиль…" />
  if (error)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
        <FormAlert message={error.message} />
        <Button onClick={() => void checkSession()}>Попробовать ещё раз</Button>
      </div>
    )
  return user ? children : null
}
