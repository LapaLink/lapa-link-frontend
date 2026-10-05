import type { CityGroup, DictionaryEntry, DictionaryLocale } from "@/types"

export function resolveDictionaryLocale(
  userLocale?: string | null,
  interfaceLocale = "ru",
): DictionaryLocale {
  return (userLocale || interfaceLocale).toLowerCase().split("-")[0] === "be"
    ? "be"
    : "ru"
}

export function getDictionaryName(
  entries: readonly DictionaryEntry[] | undefined,
  code: string | null | undefined,
  locale: DictionaryLocale,
): string {
  if (!code) return ""
  const entry = entries?.find((item) => item.code === code)
  return (locale === "be" ? entry?.nameBe : entry?.nameRu) || code
}

export function getCityName(
  groups: readonly CityGroup[] | undefined,
  code: string | null | undefined,
  locale: DictionaryLocale,
): string {
  return getDictionaryName(
    groups?.flatMap((group) => group.cities),
    code,
    locale,
  )
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е")
}

export function filterCities(
  groups: readonly CityGroup[],
  query: string,
): CityGroup[] {
  const search = normalizeSearch(query)
  return groups.flatMap((group) => {
    const cities = group.cities.filter((city) =>
      [city.code, city.nameRu, city.nameBe].some((value) =>
        normalizeSearch(value).includes(search),
      ),
    )
    return cities.length ? [{ ...group, cities }] : []
  })
}
