import { ApiError, getErrorMessage } from "@/api"

/** getErrorMessage with chat wording for OPERATION_IN_PROGRESS, whose shared text is about cases. */
export function chatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === "OPERATION_IN_PROGRESS")
    return "Запрос уже обрабатывается, попробуйте через пару секунд."
  return getErrorMessage(error, fallback)
}
