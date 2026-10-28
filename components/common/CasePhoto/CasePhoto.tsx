"use client"

import Image from "next/image"
import { useState } from "react"
import { normalizeRemoteImageUrl } from "@/lib/images"
import { Skeleton } from "@/components/ui"

export function CasePhoto({
  src,
  alt,
  priority = false,
  aspect = "aspect-video",
  compact = false,
}: {
  src?: string | null
  alt: string
  priority?: boolean
  /** Tailwind aspect-ratio class of the photo and its placeholder. */
  aspect?: string
  /** Thumbnail: a smaller image request and a placeholder without the caption. */
  compact?: boolean
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
        width={compact ? 160 : 960}
        height={compact ? 160 : 540}
        priority={priority}
        onLoad={() => setLoadedSource(source)}
        onError={() => setFailedSource(source)}
        className={`${aspect} w-full object-cover`}
      />
    </div>
  ) : compact ? (
    <div
      role="img"
      aria-label="Фото животного пока нет"
      className={`flex ${aspect} items-center justify-center bg-primary-soft`}
    >
      <Image
        src="/icon.svg"
        alt=""
        width={32}
        height={32}
        className="h-auto w-1/2 opacity-80"
      />
    </div>
  ) : (
    <div
      role="img"
      aria-label="Фото животного пока нет"
      className={`flex ${aspect} flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_40%,var(--card)_0%,var(--primary-soft)_70%)]`}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-card shadow-sm ring-1 ring-primary/10 sm:size-20">
        <Image
          src="/icon.svg"
          alt=""
          width={56}
          height={56}
          className="h-auto w-3/5 opacity-80"
        />
      </span>
      <span aria-hidden className="text-xs font-semibold text-primary/70">
        Фото пока нет
      </span>
    </div>
  )
}
