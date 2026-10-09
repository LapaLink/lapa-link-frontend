function extractMarkdownUrl(value: string) {
  const match = value.match(/^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/)
  return match?.[1] ?? value
}

export function normalizeRemoteImageUrl(value?: string | null) {
  if (!value) return null
  const source = extractMarkdownUrl(value.trim())
  try {
    const url = new URL(source, "https://local.invalid")
    const prefix = url.pathname.startsWith("/storage/v1/object/public/images/")
      ? "/storage/v1/object/public/images/"
      : "/images/"
    if (!url.pathname.startsWith(prefix)) return null
    const path = url.pathname.slice(prefix.length)
    if (
      !path ||
      path
        .split("/")
        .some((part) => !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(part))
    )
      return null
    return `/images/${path}`
  } catch {
    return null
  }
}
