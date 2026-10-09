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

export function getImageStorageUrl() {
  const configured = process.env.IMAGE_STORAGE_URL
  if (!configured && new URL(getBackendUrl()).hostname === "localhost")
    return "http://localhost:9010/images/"
  try {
    const url = new URL(configured || "")
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error()
    return `${url.href.replace(/\/$/, "")}/`
  } catch {
    throw new Error(
      "Set IMAGE_STORAGE_URL to the public images bucket URL in the server environment.",
    )
  }
}
