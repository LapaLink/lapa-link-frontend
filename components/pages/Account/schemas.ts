import { z } from "zod"
import { emailSchema, passwordSchema, otpCodeSchema } from "@/lib/validation"

const avatarFormats = ["image/jpeg", "image/png", "image/gif", "image/webp"]
export const AVATAR_ACCEPT = avatarFormats.join(",")
export const avatarSchema = z
  .file()
  .min(1, "Этот файл пустой. Выберите другое фото.")
  .max(5 * 1024 * 1024, "Фото слишком большое. Выберите файл до 5 МБ.")
  .mime(avatarFormats, "Выберите фото в формате JPEG, PNG, GIF или WEBP.")

export const emailChangeSchema = z.object({
  newEmail: emailSchema,
  password: passwordSchema,
})
export const emailConfirmationSchema = z.object({ code: otpCodeSchema })
export type EmailChangeValues = z.infer<typeof emailChangeSchema>
export type EmailConfirmationValues = z.infer<typeof emailConfirmationSchema>
