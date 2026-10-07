import { CaseCityField } from "@/components/common"
import type { DictionaryLocale } from "@/types"

export function CityField({ locale }: { locale: DictionaryLocale }) {
  return <CaseCityField locale={locale} withCoordinates />
}
