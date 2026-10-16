import { authApi } from "@/api"
import type { RegistrationCompleteDto } from "@/types"
import { registrationStorage, type OtpConfirmation } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import { getOtpFlowErrorAction } from "./otpFlowErrors"
import { restartOtpFlow, type OtpFlow, type OtpStepResult } from "./otpFlow"

export const REGISTRATION_EXPIRED =
  "Время на завершение регистрации истекло. Запросите новый код."
export const ALREADY_REGISTERED =
  "Регистрация уже завершена. Войдите в аккаунт."

export const registrationFlow: OtpFlow = {
  type: "EMAIL_VERIFICATION",
  storage: registrationStorage,
  requestCode: authApi.register,
  routes: {
    start: ROUTES.REGISTER,
    code: ROUTES.REGISTRATION_CODE,
    next: ROUTES.REGISTRATION_COMPLETE,
  },
}

/**
 * Sets the password and name; `complete` stores the returned tokens, so the
 * user lands signed in on the profile setup (onboarding).
 */
export async function submitRegistration(
  confirmation: OtpConfirmation,
  values: Pick<RegistrationCompleteDto, "password" | "displayName">,
  complete: (dto: RegistrationCompleteDto) => Promise<unknown>,
): Promise<OtpStepResult> {
  try {
    await complete({
      confirmationToken: confirmation.confirmationToken,
      ...values,
    })
    registrationStorage.clearConfirmation()
    return { redirect: ROUTES.WELCOME }
  } catch (error) {
    const action = getOtpFlowErrorAction(error)
    if (action === "confirmation-invalid")
      return restartOtpFlow(
        registrationFlow,
        confirmation.email,
        REGISTRATION_EXPIRED,
      )
    if (action === "already-verified") {
      registrationStorage.clearPending()
      registrationStorage.clearConfirmation()
      return { redirect: ROUTES.LOGIN, toast: ALREADY_REGISTERED }
    }
    return { action, error }
  }
}
