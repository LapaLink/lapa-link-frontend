import { z } from "zod"
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/needs"
import type {
  CaseNeed,
  CreateNeedDto,
  NeedDetails,
  NeedPriority,
  UpdateNeedDto,
} from "@/types"

export const NEED_COMMENT_MAX = 1000
export const NEED_AREA_MAX = 100
export const NEED_CARGO_MAX = 300
export const NEED_CONDITIONS_MAX = 1000
export const FOSTER_DAYS_MAX = 365

/** Need types with extra fields and the `details` keys each one accepts. */
export const needDetailFields = {
  TRANSPORT: ["fromArea", "toArea", "cargo"],
  FOSTER: ["periodDays", "conditions"],
} as const satisfies Record<string, readonly (keyof NeedDetailsValues)[]>

export function hasNeedDetails(
  type: string,
): type is keyof typeof needDetailFields {
  return type in needDetailFields
}

const detailText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} — не длиннее ${max} символов.`)

const needDetailsSchema = z.object({
  fromArea: detailText(NEED_AREA_MAX, "Откуда"),
  toArea: detailText(NEED_AREA_MAX, "Куда"),
  cargo: detailText(NEED_CARGO_MAX, "Что перевозим"),
  // Kept as the input's text; checked as an integer below.
  periodDays: z
    .string()
    .trim()
    .refine(
      (value) =>
        !value ||
        (/^\d+$/.test(value) &&
          Number(value) >= 1 &&
          Number(value) <= FOSTER_DAYS_MAX),
      `Укажите целое число дней от 1 до ${FOSTER_DAYS_MAX}.`,
    ),
  conditions: detailText(NEED_CONDITIONS_MAX, "Условия"),
})

type NeedDetailsValues = z.infer<typeof needDetailsSchema>

export const needPriorityLabels: Record<NeedPriority, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
}

/**
 * Need form validation. For an edited need a time window bound that is
 * already saved cannot be cleared (the API treats a missing value as "keep"),
 * and an unchanged past deadline does not block saving other fields.
 */
export function needFormSchema(original?: CaseNeed, now = () => Date.now()) {
  const initial = original ? getNeedFormValues(original) : undefined
  return z
    .object({
      type: z.string().min(1, "Выберите вид помощи."),
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
      startsAt: z.string(),
      deadline: z.string(),
      comment: z
        .string()
        .trim()
        .max(
          NEED_COMMENT_MAX,
          `Комментарий должен быть не длиннее ${NEED_COMMENT_MAX} символов.`,
        ),
      details: needDetailsSchema,
    })
    .superRefine((values, context) => {
      for (const field of ["startsAt", "deadline"] as const)
        if (initial?.[field] && !values[field])
          context.addIssue({
            code: "custom",
            path: [field],
            message: "Убрать время пока нельзя, его можно только изменить.",
          })
      const start = fromLocalDateTimeInput(values.startsAt)
      const end = fromLocalDateTimeInput(values.deadline)
      if (
        end &&
        values.deadline !== initial?.deadline &&
        new Date(end).getTime() <= now()
      )
        context.addIssue({
          code: "custom",
          path: ["deadline"],
          message: "Срок должен быть в будущем.",
        })
      if (start && end && new Date(start) >= new Date(end))
        context.addIssue({
          code: "custom",
          path: ["deadline"],
          message: "Срок должен быть позже времени начала.",
        })
    })
}

export type NeedFormValues = z.infer<ReturnType<typeof needFormSchema>>

export function getNeedFormValues(need?: CaseNeed): NeedFormValues {
  const details: { [key: string]: unknown } = need?.details ?? {}
  const text = (key: keyof NeedDetailsValues) =>
    details[key] == null ? "" : String(details[key])
  return {
    type: need?.type ?? "",
    priority: need?.priority ?? "MEDIUM",
    startsAt: toLocalDateTimeInput(need?.startsAt),
    deadline: toLocalDateTimeInput(need?.deadline),
    comment: need?.comment ?? "",
    details: {
      fromArea: text("fromArea"),
      toArea: text("toArea"),
      cargo: text("cargo"),
      periodDays: text("periodDays"),
      conditions: text("conditions"),
    },
  }
}

/**
 * Filled detail fields of the given type only: fields left from another type
 * picked earlier would get 400 NEED_DETAILS_INVALID.
 */
function toNeedDetails(type: string, values: NeedDetailsValues): NeedDetails {
  if (!hasNeedDetails(type)) return {}
  const result: { [key: string]: string | number } = {}
  for (const key of needDetailFields[type]) {
    const value = values[key].trim()
    if (value) result[key] = key === "periodDays" ? Number(value) : value
  }
  return result as NeedDetails
}

export function toCreateNeedDto(values: NeedFormValues): CreateNeedDto {
  const details = toNeedDetails(values.type, values.details)
  const startsAt = fromLocalDateTimeInput(values.startsAt)
  const deadline = fromLocalDateTimeInput(values.deadline)
  return {
    type: values.type,
    priority: values.priority,
    ...(startsAt && { startsAt }),
    ...(deadline && { deadline }),
    ...(values.comment && { comment: values.comment }),
    ...(Object.keys(details).length && { details }),
  }
}

/**
 * Only the fields that differ from the saved need; an emptied comment is sent
 * as "". Changed details are sent whole, since they replace the saved ones.
 */
export function toUpdateNeedDto(
  values: NeedFormValues,
  original: CaseNeed,
): UpdateNeedDto {
  const initial = getNeedFormValues(original)
  const result: UpdateNeedDto = {}
  if (values.priority !== initial.priority) result.priority = values.priority
  for (const field of ["startsAt", "deadline"] as const) {
    const value = fromLocalDateTimeInput(values[field])
    if (values[field] !== initial[field] && value) result[field] = value
  }
  if (values.comment !== initial.comment) result.comment = values.comment
  const details = toNeedDetails(original.type, values.details)
  if (
    JSON.stringify(details) !==
    JSON.stringify(toNeedDetails(original.type, initial.details))
  )
    result.details = details
  return result
}
