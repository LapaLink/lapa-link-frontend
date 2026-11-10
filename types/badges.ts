export type BadgeCategory =
  "AUTHOR" | "HELPER" | "ADOPTION" | "TRUST" | "COMMUNICATION"

type BadgeInfo = {
  code: string
  category: BadgeCategory
  name: string
  description: string
  icon: string | null
}

export type BadgeResponse = BadgeInfo & { awardedAt: string }

export type MyBadgeResponse = BadgeInfo & {
  threshold: number
  progress: number
  earned: boolean
  awardedAt: string | null
}
