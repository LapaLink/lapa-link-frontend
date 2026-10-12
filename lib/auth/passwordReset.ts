import type { PasswordForgotResponse } from "@/types"

export type PendingPasswordReset = {
  requestId: string
  email: string
  expiresAt: number
  resendAt: number
}
// A storage namespace, not a secret. Passwords and email codes are never saved here.
const PASSWORD_RESET_STORAGE_KEY = "lapalink.password-reset"
// One-shot hand-offs between the login screen and the reset flow.
const PASSWORD_RESET_EMAIL_KEY = "lapalink.password-reset-email"
const PASSWORD_RESET_DONE_KEY = "lapalink.password-reset-done"

/** Stores a fresh code request, replacing any previous requestId. */
export function savePendingPasswordReset(
  response: PasswordForgotResponse,
  email: string,
): PendingPasswordReset {
  const pending = {
    requestId: response.requestId,
    email,
    expiresAt: Date.now() + response.expiresInSeconds * 1000,
    resendAt: Date.now() + response.resendAvailableInSeconds * 1000,
  }
  updatePendingPasswordReset(pending)
  return pending
}
export function readPendingPasswordReset(): PendingPasswordReset | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(PASSWORD_RESET_STORAGE_KEY) || "null",
    )
    return value &&
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
export function updatePendingPasswordReset(pending: PendingPasswordReset) {
  sessionStorage.setItem(PASSWORD_RESET_STORAGE_KEY, JSON.stringify(pending))
}
export function clearPendingPasswordReset() {
  sessionStorage.removeItem(PASSWORD_RESET_STORAGE_KEY)
}

export function setPasswordResetEmail(email: string) {
  if (email) sessionStorage.setItem(PASSWORD_RESET_EMAIL_KEY, email)
  else sessionStorage.removeItem(PASSWORD_RESET_EMAIL_KEY)
}
export function takePasswordResetEmail() {
  const email = sessionStorage.getItem(PASSWORD_RESET_EMAIL_KEY) || ""
  sessionStorage.removeItem(PASSWORD_RESET_EMAIL_KEY)
  return email
}
export function markPasswordResetDone() {
  sessionStorage.setItem(PASSWORD_RESET_DONE_KEY, "1")
}
export function takePasswordResetDone() {
  const done = sessionStorage.getItem(PASSWORD_RESET_DONE_KEY) === "1"
  sessionStorage.removeItem(PASSWORD_RESET_DONE_KEY)
  return done
}
