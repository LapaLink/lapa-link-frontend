function extractMarkdownUrl(value: string) {
  const match = value.match(/^\[[^\]]+\]\((https?:\/\/[^)]+)\)$/)
  return match?.[1] ?? value
}

export function normalizeRemoteImageUrl(value?: string | null) {
  if (!value) return null
  const source = extractMarkdownUrl(value.trim())
  try {
    const url = new URL(source)
    if (url.pathname.startsWith("/images/"))
      return `${url.pathname}${url.search}`
  } catch {
    return source
  }
  return source
}
