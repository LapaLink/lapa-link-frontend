/** How long a "typing" event lasts without a refresh; the sender repeats it every few seconds. */
export const TYPING_TTL = 6000

const NONE: readonly string[] = []

/**
 * Who is typing in which conversation. Every entry expires on its own after
 * `ttl`, so a missed `typing: false` (closed tab, lost connection) does not
 * leave the indicator on. `get` returns a stable array per change, as
 * useSyncExternalStore requires.
 */
export function createTypingStore(ttl = TYPING_TTL) {
  const entries = new Map<string, Map<string, ReturnType<typeof setTimeout>>>()
  const snapshots = new Map<string, readonly string[]>()
  const listeners = new Set<() => void>()

  const changed = (conversationId: string) => {
    const users = entries.get(conversationId)
    if (users?.size) snapshots.set(conversationId, [...users.keys()])
    else {
      entries.delete(conversationId)
      snapshots.delete(conversationId)
    }
    listeners.forEach((listener) => listener())
  }
  const remove = (conversationId: string, userId: string) => {
    const users = entries.get(conversationId)
    const timer = users?.get(userId)
    if (!users || timer === undefined) return
    clearTimeout(timer)
    users.delete(userId)
    changed(conversationId)
  }

  return {
    set(conversationId: string, userId: string, typing: boolean) {
      if (!typing) return remove(conversationId, userId)
      const users = entries.get(conversationId) ?? new Map()
      entries.set(conversationId, users)
      const known = users.has(userId)
      clearTimeout(users.get(userId))
      users.set(
        userId,
        setTimeout(() => remove(conversationId, userId), ttl),
      )
      if (!known) changed(conversationId)
    },
    /** Ids of the users typing in the conversation. */
    get: (conversationId: string) => snapshots.get(conversationId) ?? NONE,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    clear() {
      entries.forEach((users) => users.forEach(clearTimeout))
      entries.clear()
      snapshots.clear()
      listeners.forEach((listener) => listener())
    },
  }
}

export type TypingStore = ReturnType<typeof createTypingStore>
