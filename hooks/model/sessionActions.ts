import type { QueryClient } from "@tanstack/react-query"
import { accountApi, ApiError } from "@/api"
import {
  getSessionSnapshot,
  getSessionRevision,
  readTokens,
  replaceSession,
} from "@/lib/auth"
import type { Tokens } from "@/types"
import { currentUserOptions } from "./accountQuery"
import { DICTIONARIES_QUERY_KEY } from "./dictionaryQueries"

const privateQueries = {
  predicate: (query: { queryKey: readonly unknown[] }) =>
    query.queryKey[0] !== DICTIONARIES_QUERY_KEY[0],
}

export async function completeSignIn(client: QueryClient, tokens: Tokens) {
  await client.cancelQueries(privateQueries)
  client.removeQueries(privateQueries)
  replaceSession(tokens)
  const revision = getSessionRevision()
  const user = await client.fetchQuery(currentUserOptions(getSessionSnapshot()))
  if (revision !== getSessionRevision() || !readTokens())
    throw new ApiError("Вход прерван. Попробуйте ещё раз.", 401)
  return user
}

export async function logoutSession(client: QueryClient) {
  const sessionAtStart = getSessionRevision()
  try {
    if (readTokens()) await accountApi.logout()
  } finally {
    if (sessionAtStart === getSessionRevision()) {
      await client.cancelQueries(privateQueries)
      client.removeQueries(privateQueries)
      replaceSession(null)
    }
  }
}
