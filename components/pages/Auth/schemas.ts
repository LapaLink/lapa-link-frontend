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

export const forgotPasswordSchema = z.object({ email: emailSchema })
export const resetPasswordSchema = z
  .object({
    code: otpCodeSchema,
    newPassword: passwordSchema.refine(
      (value) => Array.from(value).length >= 8,
      "Придумайте пароль хотя бы из 8 символов.",
    ),
    confirmPassword: z.string().min(1, "Повторите новый пароль."),
  })
  .refine((values) => values.confirmPassword === values.newPassword, {
    path: ["confirmPassword"],
    message: "Пароли не совпадают.",
  })

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type VerificationValues = z.infer<typeof verificationSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
