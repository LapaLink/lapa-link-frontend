import type { FieldValues, Path, UseFormReturn } from "react-hook-form"
import { ApiError } from "@/api"

export function setFormError<T extends FieldValues>(
  form: UseFormReturn<T>,
  error: unknown,
) {
  const values = form.getValues()
  let hasFieldErrors = false
  if (error instanceof ApiError) {
    for (const [field, message] of Object.entries(error.fields)) {
      if (!(field in values)) continue
      const friendlyMessage =
        field === "password" && /байт|utf.?8/i.test(message)
          ? "Пароль слишком длинный. Попробуйте сделать его короче."
          : message
      form.setError(field as Path<T>, {
        type: "server",
        message: friendlyMessage,
      })
      hasFieldErrors = true
    }
  }
  if (!hasFieldErrors)
    form.setError("root", {
      message:
        error instanceof Error
          ? error.message
          : "Что-то пошло не так. Попробуйте ещё раз.",
    })
}
