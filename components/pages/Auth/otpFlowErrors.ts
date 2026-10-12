import { ApiError } from "@/api"

/**
 * How the registration and password reset screens react to a failed request:
 * - `show-error` — show the backend message or highlight fields from its validation details;
 * - `invalid-code` — clear the code, keep the password;
 * - `expired` — the code is expired or already used, offer a resend;
 * - `exhausted` — the code is burnt after too many attempts, request a new one;
 * - `locked` — the daily limit is reached, block the form;
 * - `throttled` — wait for `retryAfterSeconds` before trying again;
 * - `in-progress` — the same operation is already running on the server;
 * - `already-exists` — an account with this email exists, offer sign-in or password reset;
 * - `already-verified` — registration is already completed (e.g. in another tab), go to sign-in;
 * - `unsupported` — the code type cannot be confirmed here, restart from the email screen;
 * - `confirmation-invalid` — the confirmation token is expired or used, restart from the email screen;
 * - `unknown` — 5xx or network failure: generic toast, keep the form as is.
 */
export type OtpFlowErrorAction =
  | "show-error"
  | "invalid-code"
  | "expired"
  | "exhausted"
  | "locked"
  | "throttled"
  | "in-progress"
  | "unsupported"
  | "confirmation-invalid"
  | "already-exists"
  | "already-verified"
  | "unknown"

export function getOtpFlowErrorAction(error: unknown): OtpFlowErrorAction {
  if (!(error instanceof ApiError)) return "unknown"
  switch (error.code) {
    case "OTP_INVALID":
      return "invalid-code"
    case "OTP_EXPIRED":
      return "expired"
    case "OTP_ATTEMPTS_EXCEEDED":
      return "exhausted"
    case "OTP_DAILY_LIMIT_EXCEEDED":
      return "locked"
    case "OTP_RESEND_TOO_OFTEN":
    case "RATE_LIMITED":
    case "IP_BLOCKED":
      return "throttled"
    case "OPERATION_IN_PROGRESS":
      return "in-progress"
    case "OTP_CONFIRMATION_NOT_SUPPORTED":
      return "unsupported"
    case "OTP_CONFIRMATION_INVALID":
      return "confirmation-invalid"
    case "USER_ALREADY_EXISTS":
      return "already-exists"
    case "EMAIL_ALREADY_VERIFIED":
      return "already-verified"
  }
  if (error.status === 429) return "throttled"
  if (error.status === 0 || error.status >= 500) return "unknown"
  return "show-error"
}
