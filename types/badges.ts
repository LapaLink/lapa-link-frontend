export type BadgeCategory =
  "AUTHOR" | "HELPER" | "ADOPTION" | "TRUST" | "COMMUNICATION"

type BadgeInfo = {
  code: string
  category: BadgeCategory
  name: string
  description: string
  icon: string | null
  /**
   * Public link to the picture an admin uploaded (JPEG, PNG, GIF or WEBP),
   * null when there is none. Use it as is: an admin may replace the picture,
   * so it is neither built nor stored by the app.
   */
  imageUrl: string | null
}

export type BadgeResponse = BadgeInfo & { awardedAt: string }

export type MyBadgeResponse = BadgeInfo & {
  threshold: number
  progress: number
  earned: boolean
  awardedAt: string | null
}
