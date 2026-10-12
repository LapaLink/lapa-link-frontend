import { z } from "zod"
import { emailSchema, passwordSchema, otpCodeSchema } from "@/lib/validation"

const newPassword = passwordSchema.refine(
  (value) => Array.from(value).length >= 8,
  "Придумайте пароль хотя бы из 8 символов.",
)
const passwordsMatch = {
  path: ["confirmPassword"],
  message: "Пароли не совпадают.",
}

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})
export const registerSchema = z.object({ email: emailSchema })
export const completeRegistrationSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(1, "Подскажите, как к вам обращаться.")
      .max(100, "Имя слишком длинное. Используйте до 100 символов."),
    password: newPassword,
    confirmPassword: z.string().min(1, "Повторите пароль."),
  })
  .refine((values) => values.confirmPassword === values.password, passwordsMatch)
export const verificationSchema = z.object({
  code: otpCodeSchema,
})

export const forgotPasswordSchema = z.object({ email: emailSchema })
export const newPasswordSchema = z
  .object({
    newPassword,
    confirmPassword: z.string().min(1, "Повторите новый пароль."),
  })
  .refine(
    (values) => values.confirmPassword === values.newPassword,
    passwordsMatch,
  )

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type CompleteRegistrationValues = z.infer<
  typeof completeRegistrationSchema
>
export type VerificationValues = z.infer<typeof verificationSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
