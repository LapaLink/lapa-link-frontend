import type {
  OtpConfirmDto,
  OtpConfirmResponse,
  OtpRequestResponse,
} from "@/types"
import type { OtpConfirmation, OtpFlowStorage, PendingOtp } from "@/lib/auth"
import { getOtpFlowErrorAction, type OtpFlowErrorAction } from "./otpFlowErrors"

export const GENERIC_ERROR = "Что-то пошло не так, попробуйте позже."

/** An email → code → final step flow (registration, password reset). */
export type OtpFlow = {
  /** The `type` expected from `/auth/otp/confirm`. */
  type: string
  storage: OtpFlowStorage
  /** Sends (or re-sends) a code to the email. */
  requestCode: (email: string) => Promise<OtpRequestResponse>
  routes: { start: string; code: string; next: string }
}

/** Either where the flow goes next (with an optional toast) or what the current screen should show. */
export type OtpStepResult =
  | { redirect: string; toast?: string }
  | { action: OtpFlowErrorAction; error: unknown }

/** Back to the email screen with the email prefilled and no stale request data. */
export function restartOtpFlow(
  flow: OtpFlow,
  email: string,
  toast: string,
): OtpStepResult {
  flow.storage.clearPending()
  flow.storage.clearConfirmation()
  flow.storage.setEmail(email)
  return { redirect: flow.routes.start, toast }
}

/** Requests a code and opens the code screen; a new requestId replaces the old one. */
export async function requestOtpCode(
  flow: OtpFlow,
  email: string,
  request: (email: string) => Promise<OtpRequestResponse>,
): Promise<OtpStepResult> {
  try {
    flow.storage.savePending(await request(email), email)
    flow.storage.clearConfirmation()
    return { redirect: flow.routes.code }
  } catch (error) {
    return { action: getOtpFlowErrorAction(error), error }
  }
}

/** Which data the code screen works with, or where to send a direct visit. */
export function openOtpCodeStep(
  flow: OtpFlow,
): { pending: PendingOtp } | { redirect: string } {
  const pending = flow.storage.readPending()
  if (pending) return { pending }
  return {
    redirect: flow.storage.readConfirmation()
      ? flow.routes.next
      : flow.routes.start,
  }
}

/** The final step is available only with a confirmation token. */
export function openConfirmedStep(
  flow: OtpFlow,
): { confirmation: OtpConfirmation } | { redirect: string } {
  const confirmation = flow.storage.readConfirmation()
  return confirmation ? { confirmation } : { redirect: flow.routes.start }
}

/**
 * Exchanges the code for a confirmation token. On success the requestId is
 * dropped (the code is spent) and the token is kept for the final step.
 */
export async function confirmOtpCode(
  flow: OtpFlow,
  pending: PendingOtp,
  code: string,
  confirm: (dto: OtpConfirmDto) => Promise<OtpConfirmResponse>,
): Promise<OtpStepResult> {
  try {
    const response = await confirm({ requestId: pending.requestId, code })
    if (response.type !== flow.type)
      return restartOtpFlow(flow, pending.email, GENERIC_ERROR)
    flow.storage.clearPending()
    flow.storage.saveConfirmation(
      response.confirmationToken,
      pending.email,
      response.expiresInSeconds,
    )
    return { redirect: flow.routes.next }
  } catch (error) {
    const action = getOtpFlowErrorAction(error)
    if (action === "unsupported")
      return restartOtpFlow(flow, pending.email, GENERIC_ERROR)
    if (action === "exhausted") flow.storage.clearPending()
    return { action, error }
  }
}
