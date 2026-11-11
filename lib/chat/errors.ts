import { ApiError, getErrorMessage } from "@/api"

/** getErrorMessage with chat wording for OPERATION_IN_PROGRESS, whose shared text is about cases. */
export function chatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.code === "OPERATION_IN_PROGRESS")
    return "Запрос уже обрабатывается, попробуйте через пару секунд."
  return getErrorMessage(error, fallback)
}

/** Text for a failed personal chat request from a profile. */
export function userChatRequestError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429)
      return "Слишком много запросов на чат, попробуйте позже."
    switch (error.code) {
      case "CHAT_NOT_ALLOWED":
        return "Нельзя написать самому себе."
      case "USER_NOT_FOUND":
        return "Пользователь недоступен."
      case "CHAT_DISABLED":
        return "Пользователь отключил личные сообщения."
      case "CHAT_REQUEST_DECLINED":
        return "Запрос уже был отклонён."
    }
  }
  return chatErrorMessage(error, "Не удалось отправить запрос на чат.")
}
