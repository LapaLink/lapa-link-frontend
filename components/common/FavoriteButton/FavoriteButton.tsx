"use client"

import { Heart } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "cn"
import { savePendingFavorite, useAuth, useFavorites } from "@/hooks"
import { ROUTES } from "@/lib/constants"

/**
 * Heart that saves a case to the favorites. Optimistic: the state flips at
 * once and rolls back on an error. A guest is sent to sign in and the case is
 * saved right after. `favorite` is the server's flag when it has one; without
 * it the client's own set of ids decides.
 */
export function FavoriteButton({
  caseId,
  favorite,
  className,
}: {
  caseId: string
  favorite?: boolean | null
  className?: string
}) {
  const router = useRouter()
  const { user } = useAuth()
  const favorites = useFavorites()
  const active = !!user && favorites.isFavorite(caseId, favorite)
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
      title={active ? "Убрать из избранного" : "В избранное"}
      onClick={() => {
        if (!user) {
          savePendingFavorite(caseId)
          router.push(ROUTES.LOGIN)
          return
        }
        void favorites.setFavorite(caseId, !active)
      }}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-card/95 text-primary shadow-sm outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:active:scale-90",
        className,
      )}
    >
      <Heart
        aria-hidden
        className={cn("size-5 transition-colors", active && "fill-primary")}
      />
    </button>
  )
}
