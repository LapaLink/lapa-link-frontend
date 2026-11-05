import type {
  AdoptionRequest,
  AdoptionRequestStatus,
  CuratorAnswer,
} from "@/types"

export const ADOPTION_NEED_TYPE = "ADOPTION"
export const ADOPTION_MESSAGE_MAX = 1000

const ACTIVE: readonly string[] = ["NEW", "CONTACTED", "MEETING", "APPROVED"]
// The author moves a request only forward; steps may be skipped.
const FORWARD = ["NEW", "CONTACTED", "MEETING", "APPROVED"] as const

/** True while the request is not REJECTED or CANCELLED. */
export function isActiveAdoption(status: string) {
  return ACTIVE.includes(status)
}

/** Status label; NEW reads «На рассмотрении» to the applicant. Unknown: raw. */
export function adoptionStatusLabel(status: string, forApplicant = false) {
  const labels: Record<AdoptionRequestStatus, string> = {
    NEW: forApplicant ? "На рассмотрении" : "Новая",
    CONTACTED: "Связались",
    MEETING: "Встреча назначена",
    APPROVED: "Одобрена",
    REJECTED: "Отклонена",
    CANCELLED: "Отозвана",
  }
  return labels[status as AdoptionRequestStatus] ?? status
}

/** Statuses the author may set next: later forward steps, then REJECTED. */
export function nextAdoptionStatuses(status: string): AdoptionRequestStatus[] {
  if (!isActiveAdoption(status)) return []
  const index = FORWARD.indexOf(status as (typeof FORWARD)[number])
  return [...FORWARD.slice(index + 1), "REJECTED"]
}

export const CURATOR_QUESTION_MAX = 300
export const CURATOR_ANSWER_MAX = 1000
export const PETS_DETAILS_MAX = 300

/** The author may record follow-up questions only in these statuses. */
export function canAskCuratorQuestion(status: string) {
  return status === "CONTACTED" || status === "MEETING"
}

type Option<T extends string> = { value: T; label: string }

export const housingOptions: Option<
  "OWN_APARTMENT" | "RENTED_APARTMENT" | "OWN_HOUSE" | "OTHER"
>[] = [
  { value: "OWN_APARTMENT", label: "Своя квартира" },
  { value: "RENTED_APARTMENT", label: "Съёмная квартира" },
  { value: "OWN_HOUSE", label: "Свой дом" },
  { value: "OTHER", label: "Другое" },
]
export const ownerConsentOptions: Option<"YES" | "NO" | "NOT_REQUIRED">[] = [
  { value: "YES", label: "Да, собственник согласен" },
  { value: "NO", label: "Нет" },
]
export const experienceOptions: Option<
  "HAD_DOGS" | "HAD_CATS" | "HAD_OTHER" | "FIRST_PET"
>[] = [
  { value: "HAD_DOGS", label: "Были собаки" },
  { value: "HAD_CATS", label: "Были кошки" },
  { value: "HAD_OTHER", label: "Были другие животные" },
  { value: "FIRST_PET", label: "Первое животное" },
]
export const petsHealthOptions: Option<"YES" | "NO" | "PARTIALLY">[] = [
  { value: "YES", label: "Да" },
  { value: "PARTIALLY", label: "Частично" },
  { value: "NO", label: "Нет" },
]
export const travelOptions: Option<
  "RELATIVES_OR_FRIENDS" | "PET_HOTEL" | "TAKE_WITH_ME" | "NOT_DECIDED"
>[] = [
  { value: "RELATIVES_OR_FRIENDS", label: "Родственники или друзья" },
  { value: "PET_HOTEL", label: "Зоогостиница" },
  { value: "TAKE_WITH_ME", label: "Возьму с собой" },
  { value: "NOT_DECIDED", label: "Пока не решил(а)" },
]

const labelOf = (
  options: readonly { value: string; label: string }[],
  value: unknown,
) => options.find((option) => option.value === value)?.label ?? String(value)

const yesNo = (value: unknown) => (value === true ? "Да" : "Нет")

/**
 * The filled questionnaire as label/value rows; keys the app does not know
 * show their raw value, `curator_*` keys and missing keys are skipped.
 */
export function questionnaireRows(answers: Record<string, unknown> = {}) {
  const rows: Array<[string, string]> = []
  const add = (
    key: string,
    label: string,
    show: (value: unknown) => string,
  ) => {
    if (answers[key] !== undefined && answers[key] !== null)
      rows.push([label, show(answers[key])])
  }
  add("housingType", "Жильё", (v) => labelOf(housingOptions, v))
  add("ownerConsent", "Согласие собственника", (v) =>
    v === "NOT_REQUIRED" ? "Не требуется" : labelOf(ownerConsentOptions, v),
  )
  add("familyAgreement", "Все члены семьи согласны", yesNo)
  add("hasYoungChildren", "Есть дети до 7 лет", yesNo)
  add("petExperience", "Опыт с животными", (v) => labelOf(experienceOptions, v))
  add("hasCurrentPets", "Есть питомцы сейчас", yesNo)
  add("currentPetsDetails", "Кто и сколько", String)
  add("currentPetsHealthStatus", "Стерилизованы и вакцинированы", (v) =>
    labelOf(petsHealthOptions, v),
  )
  add("travelPlan", "В поездках животное останется", (v) =>
    labelOf(travelOptions, v),
  )
  add("readyForSterilization", "Готовы к стерилизации", yesNo)
  return rows
}

/**
 * Follow-up questions from `curator_<epoch millis>` keys, in the order they
 * were added; entries with a malformed value are skipped.
 */
export function curatorAnswers(
  answers: AdoptionRequest["answers"],
): Array<CuratorAnswer & { key: string }> {
  return Object.entries(answers ?? {})
    .filter(([key]) => /^curator_\d+$/.test(key))
    .sort(([a], [b]) => Number(a.slice(8)) - Number(b.slice(8)))
    .flatMap(([key, value]) => {
      const entry = value as Partial<CuratorAnswer> | null
      return typeof entry?.question === "string" &&
        typeof entry.answer === "string"
        ? [{ key, question: entry.question, answer: entry.answer }]
        : []
    })
}
