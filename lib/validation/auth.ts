import { z } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Укажите вашу почту.")
  .max(320, "Адрес почты слишком длинный.")
  .pipe(z.email("Проверьте адрес почты, например name@example.com."))

export const passwordSchema = z
  .string()
  .min(1, "Введите пароль.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Пароль слишком длинный. Попробуйте сделать его короче.",
  )

export const otpCodeSchema = z
  .string()
  .length(6, "Введите все 6 цифр из письма.")
  .regex(/^\d{6}$/, "Введите все 6 цифр из письма.")
