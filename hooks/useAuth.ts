"use client"

import { useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getSessionSnapshot,
  getServerSessionSnapshot,
  subscribeSession,
} from "@/lib/auth"
import { currentUserOptions } from "./model/accountQuery"

export function useAuth() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  )
  const query = useQuery(currentUserOptions(session))

  return {
    user:
      session.endsWith(":authenticated") && !query.isError
        ? query.data
        : undefined,
    isLoading: session === "initializing" || (query.isFetching && !query.data),
    error: query.error,
    checkSession: query.refetch,
  }
}
