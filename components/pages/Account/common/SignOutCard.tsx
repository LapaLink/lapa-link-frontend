"use client"

import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { useLogout } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { LoadingButton, SectionCard } from "@/components/common"

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
    <SectionCard
      icon={LogOut}
      title={
        <span className="text-sm font-semibold sm:text-base">
          Выйти из аккаунта на этом устройстве
        </span>
      }
      action={
        <LoadingButton
          type="button"
          variant="outline"
          className="h-11 sm:h-10"
          loading={logout.isPending}
          loadingText="Выходим…"
          onClick={() => void signOut()}
        >
          <LogOut data-icon="inline-start" />
          Выйти
        </LoadingButton>
      }
    />
  )
}
