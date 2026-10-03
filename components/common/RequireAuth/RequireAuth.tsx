"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui"
import { FormAlert } from "../FormAlert/FormAlert"

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error, checkSession } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (!isLoading && !user && !error) router.replace(ROUTES.LOGIN)
  }, [user, isLoading, error, router])
  if (isLoading)
    return (
      <p role="status" className="p-8 text-center">
        Загружаем ваш профиль…
      </p>
    )
  if (error)
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
        <FormAlert message={error.message} />
        <Button onClick={() => void checkSession()}>Попробовать ещё раз</Button>
      </div>
    )
  return user ? children : null
}
