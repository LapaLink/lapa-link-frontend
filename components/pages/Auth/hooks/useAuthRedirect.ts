"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"

export function useAuthRedirect() {
  const { user } = useAuth()
  const router = useRouter()
  useEffect(() => {
    if (user) router.replace(ROUTES.HOME)
  }, [user, router])
}
