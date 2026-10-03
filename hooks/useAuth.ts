"use client"

import { useSyncExternalStore } from "react"
import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query"
import { accountApi, ApiError } from "@/api"
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
  replaceSession,
  getSessionRevision,
  readTokens,
} from "@/lib/auth"
import type { Tokens } from "@/types"

function currentUserOptions(session: string) {
  return queryOptions({
    queryKey: ["account", "me", session],
    queryFn: ({ signal }) => accountApi.getMe(signal),
    enabled: session.endsWith(":authenticated"),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
  })
}

export function useAuth() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  )
  const client = useQueryClient()
  const query = useQuery(currentUserOptions(session))

  async function completeSignIn(tokens: Tokens) {
    await client.cancelQueries()
    client.removeQueries()
    replaceSession(tokens)
    const revision = getSessionRevision()
    const user = await client.fetchQuery(
      currentUserOptions(getSessionSnapshot()),
    )
    if (revision !== getSessionRevision() || !readTokens())
      throw new ApiError("Вход прерван. Попробуйте ещё раз.", 401)
    return user
  }

  async function logout() {
    const sessionAtStart = getSessionRevision()
    try {
      if (readTokens()) await accountApi.logout()
    } finally {
      if (sessionAtStart === getSessionRevision()) {
        await client.cancelQueries()
        client.removeQueries()
        replaceSession(null)
      }
    }
  }

  return {
    user:
      session.endsWith(":authenticated") && !query.isError
        ? query.data
        : undefined,
    isLoading: session === "initializing" || (query.isFetching && !query.data),
    error: query.error,
    checkSession: query.refetch,
    completeSignIn,
    logout,
  }
}
