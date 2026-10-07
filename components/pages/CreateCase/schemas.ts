import { z } from "zod"
import { imageSchema, approximateAgeSchema } from "@/lib/validation"
import type { CreateCaseDto } from "@/types"

function coordinate(limit: number, label: string) {
  return z
    .string()
    .trim()
    .refine(
      (value) =>
        value !== "" &&
        Number.isFinite(Number(value.replace(",", "."))) &&
        Math.abs(Number(value.replace(",", "."))) <= limit,
      `Укажите ${label} от −${limit} до ${limit}.`,
    )
}

export const createCaseSchema = z.object({
  animalType: z.enum(["CAT", "DOG"], { error: "Выберите кошку или собаку." }),
  title: z
    .string()
    .trim()
    .min(1, "Добавьте заголовок объявления.")
    .max(150, "Заголовок должен быть не длиннее 150 символов."),
  cityCode: z.string().min(1, "Выберите город.").max(64),
  latitude: coordinate(90, "широту"),
  longitude: coordinate(180, "долготу"),
  description: z
    .string()
    .trim()
    .max(2000, "Описание должно быть не длиннее 2000 символов."),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]),
  approximateAge: approximateAgeSchema,
  condition: z
    .string()
    .trim()
    .max(500, "Описание состояния должно быть не длиннее 500 символов."),
  photo: imageSchema.optional(),
  needTypes: z
    .array(z.string().min(1).max(32))
    .refine(
      (values) => new Set(values).size === values.length,
      "Выберите каждый вид помощи один раз.",
    ),
})

export type CreateCaseValues = z.infer<typeof createCaseSchema>

export function toCreateCaseDto(values: CreateCaseValues): CreateCaseDto {
  return {
    animalType: values.animalType,
    title: values.title,
    cityCode: values.cityCode,
    latitude: Number(values.latitude.replace(",", ".")),
    longitude: Number(values.longitude.replace(",", ".")),
    sex: values.sex,
    ...(values.description ? { description: values.description } : {}),
    ...(values.approximateAge ? { approximateAge: values.approximateAge } : {}),
    ...(values.condition ? { condition: values.condition } : {}),
  }
}
