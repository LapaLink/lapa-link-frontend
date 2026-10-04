import { z } from "zod"

const emailSchema = z
  .string()
  .trim()
  .min(1, "Укажите вашу почту.")
  .max(320, "Адрес почты слишком длинный.")
  .pipe(z.email("Проверьте адрес почты, например name@example.com."))
const passwordSchema = z
  .string()
  .min(1, "Введите пароль.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Пароль слишком длинный. Попробуйте сделать его короче.",
  )

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
  code: z
    .string()
    .length(6, "Введите все 6 цифр из письма.")
    .regex(/^\d{6}$/, "Введите все 6 цифр из письма."),
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type VerificationValues = z.infer<typeof verificationSchema>
