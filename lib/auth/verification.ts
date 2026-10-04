import type { OtpResponse } from "@/types"
export type PendingVerification = OtpResponse & {
  email: string
  expiresAt: number
  resendAt: number
  exhausted?: boolean
}
// A storage namespace, not a secret. Passwords and email codes are never saved here.
const VERIFICATION_STORAGE_KEY = "lapalink.verification"
export function savePendingVerification(
  response: OtpResponse,
  email: string,
): PendingVerification {
  const pending = {
    ...response,
    email,
    expiresAt: Date.now() + response.expiresInSeconds * 1000,
    resendAt: Date.now() + response.resendAvailableInSeconds * 1000,
  }
  updatePendingVerification(pending)
  return pending
}
export function readPendingVerification(): PendingVerification | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(VERIFICATION_STORAGE_KEY) || "null",
    )
    return value &&
      typeof value.userId === "string" &&
      typeof value.requestId === "string" &&
      typeof value.email === "string" &&
      Number.isFinite(value.expiresAt) &&
      Number.isFinite(value.resendAt)
      ? value
      : null
  } catch {
    return null
  }
}
export function updatePendingVerification(pending: PendingVerification) {
  sessionStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(pending))
}
export function clearPendingVerification() {
  sessionStorage.removeItem(VERIFICATION_STORAGE_KEY)
}
