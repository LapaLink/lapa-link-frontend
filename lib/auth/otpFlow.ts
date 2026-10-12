import type { OtpRequestResponse } from "@/types"

/** A sent code waiting to be confirmed. */
export type PendingOtp = {
  requestId: string
  email: string
  expiresAt: number
  resendAt: number
}
/** A confirmed code: the one-time token for the flow's final step. */
export type OtpConfirmation = {
  confirmationToken: string
  email: string
  expiresAt: number
}

function readJson(key: string) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null")
  } catch {
    return null
  }
}

/**
 * sessionStorage state of an email → code → final step flow, namespaced by
 * `name`. Keys are a storage namespace, not a secret; passwords and email
 * codes are never saved here.
 */
export function createOtpFlowStorage(name: string) {
  const pendingKey = `lapalink.${name}`
  const confirmationKey = `lapalink.${name}-confirmation`
  // One-shot hand-off of the email to the flow's first screen.
  const emailKey = `lapalink.${name}-email`

  function updatePending(pending: PendingOtp) {
    sessionStorage.setItem(pendingKey, JSON.stringify(pending))
  }
  return {
    /** Stores a fresh code request, replacing any previous requestId. */
    savePending(response: OtpRequestResponse, email: string): PendingOtp {
      const pending = {
        requestId: response.requestId,
        email,
        expiresAt: Date.now() + response.expiresInSeconds * 1000,
        resendAt: Date.now() + response.resendAvailableInSeconds * 1000,
      }
      updatePending(pending)
      return pending
    },
    readPending(): PendingOtp | null {
      const value = readJson(pendingKey)
      return value &&
        typeof value.requestId === "string" &&
        typeof value.email === "string" &&
        Number.isFinite(value.expiresAt) &&
        Number.isFinite(value.resendAt)
        ? value
        : null
    },
    updatePending,
    clearPending() {
      sessionStorage.removeItem(pendingKey)
    },
    saveConfirmation(
      confirmationToken: string,
      email: string,
      expiresInSeconds: number,
    ): OtpConfirmation {
      const confirmation = {
        confirmationToken,
        email,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      }
      sessionStorage.setItem(confirmationKey, JSON.stringify(confirmation))
      return confirmation
    },
    readConfirmation(): OtpConfirmation | null {
      const value = readJson(confirmationKey)
      return value &&
        typeof value.confirmationToken === "string" &&
        value.confirmationToken.length > 0 &&
        typeof value.email === "string" &&
        Number.isFinite(value.expiresAt)
        ? value
        : null
    },
    clearConfirmation() {
      sessionStorage.removeItem(confirmationKey)
    },
    setEmail(email: string) {
      if (email) sessionStorage.setItem(emailKey, email)
      else sessionStorage.removeItem(emailKey)
    },
    takeEmail() {
      const email = sessionStorage.getItem(emailKey) || ""
      sessionStorage.removeItem(emailKey)
      return email
    },
  }
}
export type OtpFlowStorage = ReturnType<typeof createOtpFlowStorage>

export const passwordResetStorage = createOtpFlowStorage("password-reset")
export const registrationStorage = createOtpFlowStorage("registration")
