import type { Tokens } from "@/types"
import { getSessionRevision, readTokens, saveTokens } from "@/lib/auth"

function getPreferredLocale() {
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language.split("-")[0]
  }
  return "ru"
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const codeMap: Record<string, string> = {
      ALREADY_APPLIED:
        "Вы уже откликались на эту потребность. Повторный отклик невозможен.",
      ASSIGNMENT_NOT_ACTIVE:
        "Задача уже завершена или отменена. Обновите список и попробуйте снова.",
      NEED_CLOSED:
        "Эта потребность уже закрыта. Состояние обновлено, проверьте страницу ещё раз.",
      NOT_ASSIGNEE: "У вас нет прав выполнять это действие для этой задачи.",
      NOT_RESPONSE_AUTHOR: "Вы не можете отменить чужой отклик.",
      OPERATION_IN_PROGRESS:
        "Объявление сейчас изменяется, попробуйте через пару секунд.",
      RESPONSE_NOT_PENDING:
        "Этот отклик уже обработан или отменён. Список обновлён.",
      RESPONSE_NOT_FOUND: "Отклик не найден. Список обновлён.",
    }

    if (error.code && codeMap[error.code]) return codeMap[error.code]
    if (error.status === 409) return "Операция недоступна в текущем состоянии."
    if (error.status === 403) return "Доступ ограничен."
    if (error.status === 404) return "Запись не найдена."
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}

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
  headers.set("Accept-Language", getPreferredLocale())
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json")
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
function isSessionError(error: ApiError) {
  return (
    error.status === 401 &&
    (!error.code ||
      error.code.startsWith("TOKEN_") ||
      error.code.startsWith("REFRESH_TOKEN_") ||
      error.code === "SESSION_NOT_FOUND")
  )
}
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
  { refreshOnExpired = true }: { refreshOnExpired?: boolean } = {},
): Promise<T> {
  const tokens = readTokens()
  if (!tokens) throw new ApiError("Войдите в аккаунт.", 401)
  const revision = getSessionRevision()
  const send = (token: string) => {
    const headers = new Headers(options.headers)
    headers.set("Authorization", `Bearer ${token}`)
    return request<T>(path, { ...options, headers })
  }
  try {
    return await send(tokens.accessToken)
  } catch (error) {
    if (!(error instanceof ApiError) || !isSessionError(error)) throw error
    if (revision !== getSessionRevision()) throw error
    if (error.code === "TOKEN_EXPIRED" && refreshOnExpired) {
      const next = await refresh(tokens)
      if (
        revision !== getSessionRevision() ||
        readTokens()?.accessToken !== next.accessToken
      )
        throw new ApiError("Сессия изменилась. Попробуйте ещё раз.", 401)
      try {
        return await send(next.accessToken)
      } catch (retryError) {
        if (
          retryError instanceof ApiError &&
          isSessionError(retryError) &&
          revision === getSessionRevision() &&
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
