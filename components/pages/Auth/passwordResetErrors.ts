import { ApiError } from "@/api"

/**
 * How the forgot/reset screens react to a failed request:
 * - `show-error` — show the backend message or highlight fields from its validation details;
 * - `invalid-code` — clear the code, keep the password;
 * - `expired` — the code is expired or already used, offer a resend;
 * - `exhausted` — the code is burnt after too many attempts, request a new one;
 * - `locked` — the daily limit is reached, block the form;
 * - `throttled` — wait for `retryAfterSeconds` before trying again;
 * - `in-progress` — the same operation is already running on the server;
 * - `unknown` — 5xx or network failure: generic toast, keep the form as is.
 */
export type PasswordResetErrorAction =
  | "show-error"
  | "invalid-code"
  | "expired"
  | "exhausted"
  | "locked"
  | "throttled"
  | "in-progress"
  | "unknown"

export function getPasswordResetErrorAction(
  error: unknown,
): PasswordResetErrorAction {
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
  }
  if (error.status === 429) return "throttled"
  if (error.status === 0 || error.status >= 500) return "unknown"
  return "show-error"
}
