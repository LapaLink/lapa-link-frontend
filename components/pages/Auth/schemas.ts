import { z } from "zod"
import { emailSchema, passwordSchema, otpCodeSchema } from "@/lib/validation"

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
export const registerSchema = loginSchema.extend({
  displayName: z
    .string()
    .trim()
    .min(1, "Подскажите, как к вам обращаться.")
    .max(100, "Имя слишком длинное. Используйте до 100 символов."),
  password: passwordSchema.refine(
    (value) => Array.from(value).length >= 8,
    "Придумайте пароль хотя бы из 8 символов.",
  ),
})
export const verificationSchema = z.object({
  code: otpCodeSchema,
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type VerificationValues = z.infer<typeof verificationSchema>
