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
