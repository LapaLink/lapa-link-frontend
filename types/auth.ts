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
  emailVerifiedAt?: string | null
  cityCode?: string | null
  bio?: string | null
}

export type LoginDto = {
  email: string
  password: string
}
export type OtpResponse = {
  userId: string
  requestId: string
  expiresInSeconds: number
  resendAvailableInSeconds: number
}
/** Response of a public code request (registration or password reset). */
export type OtpRequestResponse = Omit<OtpResponse, "userId">
export type OtpConfirmDto = {
  requestId: string
  code: string
}
export type OtpConfirmResponse = {
  confirmationToken: string
  type: string
  expiresInSeconds: number
}
export type RegistrationCompleteDto = {
  confirmationToken: string
  password: string
  displayName: string
}
export type PasswordResetDto = {
  confirmationToken: string
  newPassword: string
}
