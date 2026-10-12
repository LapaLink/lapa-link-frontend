import { authApi } from "@/api"
import type { PasswordResetDto } from "@/types"
import {
  markPasswordResetDone,
  passwordResetStorage,
  type PasswordResetConfirmation,
} from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { getOtpFlowErrorAction } from "./otpFlowErrors"
import { restartOtpFlow, type OtpFlow, type OtpStepResult } from "./otpFlow"

export const CONFIRMATION_EXPIRED =
  "Время на смену пароля истекло. Запросите новый код."

export const passwordResetFlow: OtpFlow = {
  type: "PASSWORD_RESET",
  storage: passwordResetStorage,
  requestCode: authApi.forgotPassword,
  routes: {
    start: ROUTES.FORGOT_PASSWORD,
    code: ROUTES.PASSWORD_RESET_CODE,
    next: ROUTES.NEW_PASSWORD,
  },
}

/** Sets the new password; an expired or used token restarts the flow. */
export async function submitNewPassword(
  confirmation: PasswordResetConfirmation,
  newPassword: string,
  reset: (dto: PasswordResetDto) => Promise<void>,
): Promise<OtpStepResult> {
  try {
    await reset({
      confirmationToken: confirmation.confirmationToken,
      newPassword,
    })
    passwordResetStorage.clearConfirmation()
    markPasswordResetDone()
    return { redirect: ROUTES.LOGIN }
  } catch (error) {
    const action = getOtpFlowErrorAction(error)
    if (action === "confirmation-invalid")
      return restartOtpFlow(
        passwordResetFlow,
        confirmation.email,
        CONFIRMATION_EXPIRED,
      )
    return { action, error }
  }
}
