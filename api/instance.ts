import type { Tokens } from "@/types"
import { readTokens, saveTokens } from "@/lib/auth"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public fields: Record<string, string> = {},
    public retryAfterSeconds?: number,
  ) {
    super(message)
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set("Accept-Language", "ru")
  if (options.body) headers.set("Content-Type", "application/json")
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      ...options,
      headers,
      cache: "no-store",
    })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error
    throw new ApiError(
      "Не удалось связаться с сервером. Попробуйте ещё раз.",
      0,
    )
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const details = body?.details || {}
    const fields: Record<string, string> = {}
    if (response.status === 400 && !details.error)
      for (const [key, value] of Object.entries(details))
        if (typeof value === "string") fields[key] = value
    const retry = Number(
      details.retryAfterSeconds ?? response.headers.get("Retry-After"),
    )
    throw new ApiError(
      body?.message ||
        (Object.keys(fields).length
          ? "Проверьте заполнение полей."
          : "Не удалось выполнить запрос. Попробуйте ещё раз."),
      response.status,
      details.error,
      fields,
      retry > 0 ? retry : undefined,
    )
  }
  return body as T
}
export const post = <T>(path: string, body?: unknown) =>
  request<T>(path, {
    method: "POST",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
let refreshPromise: Promise<Tokens> | null = null
async function refresh(stale: Tokens): Promise<Tokens> {
  const rotate = async () => {
    const current = readTokens()
    if (!current) throw new ApiError("Сессия завершена. Войдите заново.", 401)
    if (current.accessToken !== stale.accessToken) return current
    try {
      const next = await post<Tokens>("/auth/refresh", {
        refreshToken: current.refreshToken,
      })
      // Do not resurrect a session after logout or overwrite a newer login.
      if (readTokens()?.refreshToken !== current.refreshToken)
        throw new ApiError("Сессия изменилась. Войдите заново.", 401)
      saveTokens(next)
      return next
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        readTokens()?.refreshToken === current.refreshToken
      )
        saveTokens(null)
      throw error
    }
  }
  if (!refreshPromise)
    refreshPromise = (async () =>
      navigator.locks
        ? await navigator.locks.request("lapalink:refresh", rotate)
        : await rotate())().finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}
export async function authorizedRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const tokens = readTokens()
  if (!tokens) throw new ApiError("Войдите в аккаунт.", 401)
  const send = (token: string) => {
    const headers = new Headers(options.headers)
    headers.set("Authorization", `Bearer ${token}`)
    return request<T>(path, { ...options, headers })
  }
  try {
    return await send(tokens.accessToken)
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error
    if (error.code === "TOKEN_EXPIRED") {
      const next = await refresh(tokens)
      try {
        return await send(next.accessToken)
      } catch (retryError) {
        if (
          retryError instanceof ApiError &&
          retryError.status === 401 &&
          readTokens()?.accessToken === next.accessToken
        )
          saveTokens(null)
        throw retryError
      }
    }
    if (readTokens()?.accessToken === tokens.accessToken) saveTokens(null)
    throw error
  }
}
