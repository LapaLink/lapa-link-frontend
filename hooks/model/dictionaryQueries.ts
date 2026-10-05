import { queryOptions } from "@tanstack/react-query"
import { dictionariesApi } from "@/api"

export const DICTIONARIES_QUERY_KEY = ["dictionaries"] as const

const cacheOptions = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}

export const dictionaryQueries = {
  cities: () =>
    queryOptions({
      ...cacheOptions,
      queryKey: [...DICTIONARIES_QUERY_KEY, "cities"],
      queryFn: ({ signal }) => dictionariesApi.cities(signal),
    }),
  needTypes: () =>
    queryOptions({
      ...cacheOptions,
      queryKey: [...DICTIONARIES_QUERY_KEY, "need-types"],
      queryFn: ({ signal }) => dictionariesApi.needTypes(signal),
    }),
  closeReasons: () =>
    queryOptions({
      ...cacheOptions,
      queryKey: [...DICTIONARIES_QUERY_KEY, "close-reasons"],
      queryFn: ({ signal }) => dictionariesApi.closeReasons(signal),
    }),
}
