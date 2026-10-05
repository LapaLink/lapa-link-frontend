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

export async function completeSignIn(client: QueryClient, tokens: Tokens) {
  await client.cancelQueries()
  client.removeQueries()
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
      await client.cancelQueries()
      client.removeQueries()
      replaceSession(null)
    }
  }
}
