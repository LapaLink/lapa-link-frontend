import { z } from "zod"
import { approximateAgeSchema } from "@/lib/validation"
import type { CaseDetails, UpdateCaseDto } from "@/types"

export const editCaseSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Добавьте название объявления.")
    .max(150, "Название должно быть не длиннее 150 символов."),
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
  cityCode: z
    .string()
    .trim()
    .min(1, "Выберите город.")
    .max(64, "Выберите город из списка."),
})

export type EditCaseValues = z.infer<typeof editCaseSchema>

export function getEditCaseValues(item: CaseDetails): EditCaseValues {
  return {
    title: item.title,
    description: item.description ?? "",
    sex: item.sex ?? "UNKNOWN",
    approximateAge: item.approximateAge ?? "",
    condition: item.condition ?? "",
    cityCode: item.cityCode ?? "",
  }
}

export function toUpdateCaseDto(
  values: EditCaseValues,
  original: CaseDetails,
): UpdateCaseDto {
  const initial = getEditCaseValues(original)
  const result: UpdateCaseDto = {}
  for (const field of [
    "title",
    "description",
    "sex",
    "approximateAge",
    "condition",
    "cityCode",
  ] as const) {
    if (values[field] !== initial[field])
      Object.assign(result, { [field]: values[field] })
  }
  return result
}

export function canEditCase(item: CaseDetails, userId?: string) {
  return !!userId && item.author.id === userId && item.status === "OPEN"
}
