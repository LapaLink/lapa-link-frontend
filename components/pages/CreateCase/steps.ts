import type { CreateCaseValues } from "./schemas"

export const CREATE_CASE_STEPS: {
  title: string
  description: string
  fields: (keyof CreateCaseValues)[]
}[] = [
  {
    title: "Кого нашли?",
    description: "Тип животного и заголовок обязательны.",
    fields: ["animalType", "sex", "title"],
  },
  {
    title: "Подробности",
    description: "Необязательно, но так людям проще понять, что случилось.",
    fields: ["description", "approximateAge", "condition"],
  },
  {
    title: "Фото",
    description: "С фото объявление заметнее. Этот шаг можно пропустить.",
    fields: ["photo"],
  },
  {
    title: "Место находки",
    description: "Выберите город — это обязательное поле.",
    fields: ["cityCode", "latitude", "longitude"],
  },
  {
    title: "Помощь рядом",
    description: "Люди смогут понять, чем помочь животному.",
    fields: ["needTypes"],
  },
]

/** Returns the index of the first step with an invalid field, or -1. */
export function firstInvalidStep(
  isInvalid: (field: keyof CreateCaseValues) => boolean,
) {
  return CREATE_CASE_STEPS.findIndex((step) => step.fields.some(isInvalid))
}
