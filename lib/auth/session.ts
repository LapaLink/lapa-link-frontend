import type { Tokens } from "@/types"

const SESSION_KEY = "lapalink.session"
const listeners = new Set<() => void>()

export function readTokens(): Tokens | null {
  if (typeof window === "undefined") return null
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    return value &&
      typeof value.accessToken === "string" &&
      value.accessToken.length > 0 &&
      typeof value.refreshToken === "string" &&
      value.refreshToken.length > 0
      ? value
      : null
  } catch {
    return null
  }
}

export function saveTokens(tokens: Tokens | null) {
  if (tokens) localStorage.setItem(SESSION_KEY, JSON.stringify(tokens))
  else localStorage.removeItem(SESSION_KEY)
  listeners.forEach((listener) => listener())
}

// Refresh does not change identity; a newer login/logout does.
let revision = 0
export function replaceSession(tokens: Tokens | null) {
  revision += 1
  saveTokens(tokens)
}
export function getSessionRevision() {
  return revision
}

function onStorage(event: StorageEvent) {
  if (event.key === SESSION_KEY || event.key === null) {
    revision += 1
    listeners.forEach((listener) => listener())
  }
}

export function subscribeSession(callback: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage)
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
    if (listeners.size === 0) window.removeEventListener("storage", onStorage)
  }
}

export function getSessionSnapshot() {
  const tokens = readTokens()
  // Stable string for useSyncExternalStore; do not put JWTs in query keys.
  return tokens ? `${revision}:authenticated` : "anonymous"
}
export function getServerSessionSnapshot() {
  return "initializing"
}
