export type Tokens = {
  accessToken: string
  refreshToken: string
}

export type CurrentUser = {
  id: string
  email: string
  displayName: string
  roles: string[]
  avatarUrl?: string | null
  locale?: string | null
  cityCode?: string | null
  bio?: string | null
}

export type LoginDto = {
  email: string
  password: string
}
export type RegistrationDto = LoginDto & { displayName: string }
export type VerificationDto = {
  userId: string
  requestId: string
  code: string
}
export type OtpResponse = {
  userId: string
  requestId: string
  expiresInSeconds: number
  resendAvailableInSeconds: number
}
