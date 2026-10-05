import { queryOptions } from "@tanstack/react-query"
import { accountApi } from "@/api"

export const ACCOUNT_QUERY_KEY = ["account", "me"] as const

export function currentUserOptions(session: string) {
  return queryOptions({
    queryKey: [...ACCOUNT_QUERY_KEY, session],
    queryFn: ({ signal }) => accountApi.getMe(signal),
    enabled: session.endsWith(":authenticated"),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
  })
}
