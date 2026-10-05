import type { CityGroup, NeedType, CaseCloseReason } from "@/types"
import { request } from "./instance"

export const dictionariesApi = {
  cities: (signal?: AbortSignal) => request<CityGroup[]>("/cities", { signal }),
  needTypes: (signal?: AbortSignal) =>
    request<NeedType[]>("/need-types", { signal }),
  closeReasons: (signal?: AbortSignal) =>
    request<CaseCloseReason[]>("/case-close-reasons", { signal }),
}
