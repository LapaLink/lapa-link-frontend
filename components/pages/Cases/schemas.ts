import { z } from "zod"
import { fromLocalDateTimeInput, toLocalDateTimeInput } from "@/lib/needs"
import type {
  CaseNeed,
  CreateNeedDto,
  NeedPriority,
  UpdateNeedDto,
} from "@/types"

export const NEED_COMMENT_MAX = 1000

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
  return {
    type: need?.type ?? "",
    priority: need?.priority ?? "MEDIUM",
    startsAt: toLocalDateTimeInput(need?.startsAt),
    deadline: toLocalDateTimeInput(need?.deadline),
    comment: need?.comment ?? "",
  }
}

export function toCreateNeedDto(values: NeedFormValues): CreateNeedDto {
  const startsAt = fromLocalDateTimeInput(values.startsAt)
  const deadline = fromLocalDateTimeInput(values.deadline)
  return {
    type: values.type,
    priority: values.priority,
    ...(startsAt && { startsAt }),
    ...(deadline && { deadline }),
    ...(values.comment && { comment: values.comment }),
  }
}

/** Only the fields that differ from the saved need; an emptied comment is sent as "". */
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
  return result
}
