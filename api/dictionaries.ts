import type { CityGroup, NeedType, CaseCloseReason } from "@/types"
import { readTokens } from "@/lib/auth"
import { authorizedRequest, request } from "./instance"

export const dictionariesApi = {
  cities: (signal?: AbortSignal) => request<CityGroup[]>("/cities", { signal }),
  /** Public: guests need the names for feed cards and the need type filter. */
  needTypes: (signal?: AbortSignal) =>
    readTokens()
      ? authorizedRequest<NeedType[]>("/need-types", { signal })
      : request<NeedType[]>("/need-types", { signal }),
  closeReasons: (signal?: AbortSignal) =>
    authorizedRequest<CaseCloseReason[]>("/case-close-reasons", { signal }),
}
