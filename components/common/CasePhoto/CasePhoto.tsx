"use client"

import Image from "next/image"
import { useState } from "react"
import { normalizeRemoteImageUrl } from "@/lib/images"
import { Skeleton } from "@/components/ui"

export function CasePhoto({
  src,
  alt,
  priority = false,
}: {
  src?: string | null
  alt: string
  priority?: boolean
}) {
  const source = normalizeRemoteImageUrl(src)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const [loadedSource, setLoadedSource] = useState<string | null>(null)
  return source && source !== failedSource ? (
    <div className="relative">
      {source !== loadedSource && (
        <Skeleton className="absolute inset-0 rounded-none" />
      )}
      <Image
        src={source}
        alt={alt}
        width={960}
        height={540}
        priority={priority}
        onLoad={() => setLoadedSource(source)}
        onError={() => setFailedSource(source)}
        className="aspect-video w-full object-cover"
      />
    </div>
  ) : (
    <div
      role="img"
      aria-label="Фото животного пока нет"
      className="flex aspect-video items-center justify-center bg-gradient-to-br from-primary/5 via-muted/40 to-primary/10"
    >
      <Image
        src="/icon.svg"
        alt=""
        width={112}
        height={112}
        className="size-24 opacity-40 grayscale sm:size-28"
      />
    </div>
  )
}
