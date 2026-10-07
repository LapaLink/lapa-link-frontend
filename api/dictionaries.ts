import type { CityGroup, NeedType, CaseCloseReason } from "@/types"
import { authorizedRequest, request } from "./instance"

export const dictionariesApi = {
  cities: (signal?: AbortSignal) => request<CityGroup[]>("/cities", { signal }),
  needTypes: (signal?: AbortSignal) =>
    authorizedRequest<NeedType[]>("/need-types", { signal }),
  closeReasons: (signal?: AbortSignal) =>
    authorizedRequest<CaseCloseReason[]>("/case-close-reasons", { signal }),
}
