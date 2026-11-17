"use client"

import { useCallback, useEffect } from "react"
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { accountApi, ApiError, getErrorMessage } from "@/api"
import { queryKeys } from "@/lib/queryKeys"
import type { CaseListItem, PageResponse } from "@/types"
import { useAuth } from "./useAuth"

type FavoritePages = InfiniteData<PageResponse<CaseListItem>>

// Case ids with a request in flight: repeated taps on them are ignored.
const inFlight = new Set<string>()

// A guest's tap on the heart: applied right after sign-in.
const PENDING_KEY = "lapalink.pendingFavorite"

export function savePendingFavorite(caseId: string) {
  try {
    sessionStorage.setItem(PENDING_KEY, caseId)
  } catch {
    // Storage may be blocked: the guest just signs in without the follow-up.
  }
}

/**
 * Favorite cases of the signed-in user. The server does not tell a card
 * whether it is saved, so the client keeps the ids of the newest saved cases
 * (first 100) and updates them optimistically on every add/remove.
 */
export function useFavorites() {
  const { user } = useAuth()
  const client = useQueryClient()
  const ids = useQuery({
    queryKey: queryKeys.favoriteIds,
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) =>
      (await accountApi.getFavorites(0, 100, signal)).content.map(
        (item) => item.id,
      ),
  })
  const saved = ids.data

  const isFavorite = useCallback(
    (caseId: string, server?: boolean | null) =>
      server ?? saved?.includes(caseId) ?? false,
    [saved],
  )

  const setFavorite = useCallback(
    async (caseId: string, next: boolean) => {
      if (inFlight.has(caseId)) return
      inFlight.add(caseId)
      const withoutCase = (list?: string[]) =>
        (list ?? []).filter((id) => id !== caseId)
      const dropFromList = () =>
        client.setQueriesData<FavoritePages>(
          { queryKey: queryKeys.favoriteList },
          (data) =>
            data && {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                content: page.content.filter((item) => item.id !== caseId),
              })),
            },
        )
      await client.cancelQueries({ queryKey: queryKeys.favoriteIds })
      const before = client.getQueryData<string[]>(queryKeys.favoriteIds)
      client.setQueryData<string[]>(queryKeys.favoriteIds, (list) =>
        next ? [caseId, ...withoutCase(list)] : withoutCase(list),
      )
      if (!next) dropFromList()
      try {
        await (next
          ? accountApi.addFavorite(caseId)
          : accountApi.removeFavorite(caseId))
        await client.invalidateQueries({ queryKey: queryKeys.favoriteList })
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          error.code === "CASE_NOT_FOUND"
        ) {
          toast.error("Объявление недоступно")
          client.setQueryData<string[]>(queryKeys.favoriteIds, withoutCase)
          dropFromList()
        } else {
          client.setQueryData(queryKeys.favoriteIds, before)
          void client.invalidateQueries({ queryKey: queryKeys.favoriteList })
          toast.error(
            getErrorMessage(
              error,
              next
                ? "Не удалось добавить в избранное."
                : "Не удалось убрать из избранного.",
            ),
          )
        }
      } finally {
        inFlight.delete(caseId)
      }
    },
    [client],
  )

  return { isFavorite, setFavorite }
}

/** Mount once: adds the case a guest tapped before signing in. */
export function useApplyPendingFavorite() {
  const { user } = useAuth()
  const { setFavorite } = useFavorites()
  useEffect(() => {
    if (!user) return
    let caseId: string | null = null
    try {
      caseId = sessionStorage.getItem(PENDING_KEY)
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      return
    }
    if (caseId) void setFavorite(caseId, true)
  }, [user, setFavorite])
}
