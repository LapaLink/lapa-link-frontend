"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useLogout } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { LoadingButton } from "@/components/common"
import { Card, CardContent } from "@/components/ui"

export function SignOutCard() {
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
    <Card>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Выйти из аккаунта на этом устройстве.
        </p>
        <LoadingButton
          type="button"
          variant="outline"
          loading={logout.isPending}
          loadingText="Выходим…"
          onClick={() => void signOut()}
        >
          <LogOut data-icon="inline-start" />
          Выйти
        </LoadingButton>
      </CardContent>
    </Card>
  )
}
