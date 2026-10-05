export type DictionaryLocale = "ru" | "be"

export type DictionaryEntry = {
  code: string
  nameRu: string
  nameBe: string
}

export type City = DictionaryEntry & {
  latitude: number
  longitude: number
}

export type CityGroup = {
  region: string
  center: City
  cities: City[]
}

export type NeedType = DictionaryEntry & {
  sortOrder: number
  active: boolean
}

export type CaseCloseReason = DictionaryEntry & {
  requiresComment: boolean
}
