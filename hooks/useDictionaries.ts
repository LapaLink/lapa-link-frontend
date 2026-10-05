"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { resolveDictionaryLocale } from "@/lib/dictionaries"
import { useAuth } from "./useAuth"
import { dictionaryQueries } from "./model/dictionaryQueries"

export function useCities() {
  return useQuery(dictionaryQueries.cities())
}

export function useNeedTypes() {
  return useQuery(dictionaryQueries.needTypes())
}

export function useCaseCloseReasons() {
  return useQuery(dictionaryQueries.closeReasons())
}

export function useDictionaryLocale(interfaceLocale = "ru") {
  const { user } = useAuth()
  return resolveDictionaryLocale(user?.locale, interfaceLocale)
}

export function useRefreshNeedTypes() {
  const client = useQueryClient()
  return () =>
    client.invalidateQueries({
      queryKey: dictionaryQueries.needTypes().queryKey,
    })
}
