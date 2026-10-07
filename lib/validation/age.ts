import { z } from "zod"

export const approximateAgeSchema = z
  .string()
  .trim()
  .max(50, "Укажите возраст короче.")
  .refine(
    (value) =>
      value === "" ||
      /^\d{1,3}(?:\s+(?:лет|год|года|месяц|месяца|месяцев))?$/.test(value),
    "Укажите возраст числом и выберите годы или месяцы.",
  )
