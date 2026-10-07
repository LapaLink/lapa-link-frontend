import { z } from "zod"
import { emailSchema, passwordSchema, otpCodeSchema } from "@/lib/validation"

export {
  IMAGE_ACCEPT as AVATAR_ACCEPT,
  imageSchema as avatarSchema,
} from "@/lib/validation"

export const emailChangeSchema = z.object({
  newEmail: emailSchema,
  password: passwordSchema,
})
export const emailConfirmationSchema = z.object({ code: otpCodeSchema })
export type EmailChangeValues = z.infer<typeof emailChangeSchema>
export type EmailConfirmationValues = z.infer<typeof emailConfirmationSchema>

export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Укажите ваше имя.")
    .max(100, "Имя должно быть не длиннее 100 символов."),
  cityCode: z.string().max(64, "Выберите город из списка."),
  bio: z.string().max(1000, "Расскажите о себе в пределах 1000 символов."),
})
export type ProfileValues = z.infer<typeof profileSchema>
