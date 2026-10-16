"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"

/** Sends a signed-in user away from an auth page, by default to the home page. */
export function useAuthRedirect(target: string = ROUTES.HOME) {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (user) router.replace(target)
  }, [user, router, target])
}
