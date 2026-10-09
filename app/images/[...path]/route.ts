import { getImageStorageUrl } from "@/lib/config/server"

const allowedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
])

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  if (
    !path.length ||
    path.some((part) => !/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9]+)?$/.test(part))
  )
    return new Response(null, { status: 400 })
  try {
    const response = await fetch(
      new URL(path.join("/"), getImageStorageUrl()),
      {
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
        cache: "no-store",
      },
    )
    if (!response.ok)
      return new Response(null, { status: response.status === 404 ? 404 : 502 })
    const type = response.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase()
    if (!type || !allowedTypes.has(type))
      return new Response(null, { status: 502 })
    return new Response(response.body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch {
    return new Response(null, { status: 502 })
  }
}
