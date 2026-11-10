import Image from "next/image"
import { cn } from "@/lib/utils"
import { badgeArtworkPath } from "@/lib/badges"
import type { BadgeResponse } from "@/types"

export function BadgeArtwork({
  badge,
  size = 72,
  dimmed = false,
}: {
  badge?: Pick<BadgeResponse, "code" | "icon" | "category">
  size?: number
  dimmed?: boolean
}) {
  return (
    <Image
      src={badgeArtworkPath(badge)}
      width={size}
      height={size}
      alt=""
      unoptimized
      className={cn("shrink-0 object-contain", dimmed && "opacity-55")}
    />
  )
}
