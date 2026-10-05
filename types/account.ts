export type UserProfile = {
  userId: string
  cityCode: string | null
  bio: string | null
  avatarUrl: string | null
  updatedAt: string
}

export type EmailChangeDto = {
  newEmail: string
  password: string
}

export type EmailConfirmationDto = {
  requestId: string
  code: string
}
