import { z } from "zod"

const backendUrlSchema = z.url().refine((value) => {
  const url = new URL(value)
  return (
    ["http:", "https:"].includes(url.protocol) &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash &&
    url.pathname === "/"
  )
}, "BACKEND_API_URL must be an HTTP(S) origin without credentials or a path")

// Server-only deployment configuration. Never export it from a client barrel.
export function getBackendUrl() {
  const result = backendUrlSchema.safeParse(process.env.BACKEND_API_URL)
  if (!result.success)
    throw new Error("Set a valid BACKEND_API_URL in .env.local.")
  return result.data.replace(/\/$/, "")
}
