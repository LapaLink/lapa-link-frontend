"use client"

import { useState } from "react"
import { Search } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { ROUTES } from "@/lib/constants"

/**
 * Header search pill (wide screens): a query goes to the feed as `search`.
 * It is prefilled on the feed, so the pill shows what the list is filtered by.
 */
export function MainNavigation() {
  const router = useRouter()
  const current = useSearchParams()?.get("search") ?? ""
  const [query, setQuery] = useState(current)
  const [seen, setSeen] = useState(current)
  // The feed changed its own search (filters, reset): follow it.
  if (seen !== current) {
    setSeen(current)
    setQuery(current)
  }

  return (
    <form
      role="search"
      aria-label="Поиск объявлений"
      className="hidden max-w-xl flex-1 items-center gap-1 rounded-full border border-[#ebdfd7] bg-card py-1.5 pr-1.5 pl-5 shadow-[0_6px_18px_rgba(84,46,58,0.08)] lg:flex"
      onSubmit={(event) => {
        event.preventDefault()
        const text = query.trim()
        router.push(
          text
            ? `${ROUTES.CASES}?search=${encodeURIComponent(text)}`
            : ROUTES.CASES,
        )
      }}
    >
      <Search aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      <label className="flex min-w-0 flex-1">
        <span className="sr-only">Поиск</span>
        <input
          type="search"
          value={query}
          maxLength={200}
          placeholder="Кличка, район или что нужно"
          onChange={(event) => setQuery(event.target.value)}
          className="w-full min-w-0 bg-transparent px-2.5 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>
    </form>
  )
}
