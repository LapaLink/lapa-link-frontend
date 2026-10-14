import { z } from "zod"

const chatSocketUrlSchema = z.url().refine((value) => {
  // zod still runs refinements after a failed url check.
  if (!URL.canParse(value)) return false
  const url = new URL(value)
  return (
    ["ws:", "wss:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  )
}, "NEXT_PUBLIC_CHAT_WS_URL must be a ws(s):// URL without credentials, query or hash")

/**
 * Public chat socket URL for hosts that cannot proxy WebSocket upgrades
 * (e.g. Netlify): the browser then connects to the backend directly. Inlined
 * at build time; unset means the same-origin `/ws` rewrite. next.config.ts
 * calls this so an invalid value fails the build.
 */
export function getConfiguredChatSocketUrl(): string | undefined {
  // Must stay a literal property access for Next.js to inline it.
  const value = process.env.NEXT_PUBLIC_CHAT_WS_URL
  if (!value) return undefined
  const result = chatSocketUrlSchema.safeParse(value)
  if (!result.success)
    throw new Error(
      "Set NEXT_PUBLIC_CHAT_WS_URL to a ws:// or wss:// URL without credentials, query or hash, e.g. wss://api.example.by/ws.",
    )
  return result.data
}
