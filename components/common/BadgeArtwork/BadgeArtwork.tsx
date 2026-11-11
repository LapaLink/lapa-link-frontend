"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { badgeArtworkPath } from "@/lib/badges"
import type { BadgeResponse } from "@/types"

/**
 * Badge picture: the uploaded `imageUrl` first, else the local illustration
 * by `icon` / code / category, else the default one. A picture that fails to
 * load falls back to the local illustration instead of a broken image.
 */
export function BadgeArtwork({
  badge,
  size = 72,
  dimmed = false,
}: {
  badge?: Pick<BadgeResponse, "code" | "icon" | "category"> &
    Partial<Pick<BadgeResponse, "imageUrl" | "name">>
  size?: number
  dimmed?: boolean
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const url = badge?.imageUrl
  const className = cn("shrink-0 object-contain", dimmed && "opacity-55")
  if (url && url !== failedUrl)
    return (
      // The link comes from the API and may point to any host: a plain img.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        width={size}
        height={size}
        alt={badge.name ?? ""}
        loading="lazy"
        decoding="async"
        onError={() => setFailedUrl(url)}
        className={className}
      />
    )
  return (
    <Image
      src={badgeArtworkPath(badge)}
      width={size}
      height={size}
      alt=""
      unoptimized
      className={className}
    />
  )
}
