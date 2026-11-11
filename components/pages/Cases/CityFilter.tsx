"use client"

import { useRef, useState } from "react"
import { Check, ChevronDown, MapPin, Search } from "lucide-react"
import { cn } from "cn"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
} from "@/components/ui"

type CityOption = { code: string; name: string }

/**
 * City filter with a search field: the list of cities is long, so it is a
 * dropdown whose top input narrows it by name. `value` undefined is «Любой
 * город». The trigger looks like the other feed filters.
 */
export function CityFilter({
  id,
  value,
  options,
  fieldClass,
  onChange,
}: {
  id: string
  value: string | undefined
  options: readonly CityOption[]
  /** Border/background classes shared with the neighbouring fields. */
  fieldClass: string
  onChange: (code: string | undefined) => void
}) {
  const [query, setQuery] = useState("")
  const input = useRef<HTMLInputElement>(null)
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle))
    : options
  const selected = options.find((option) => option.code === value)

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return setQuery("")
        // The search field gets the focus, not the first item.
        setTimeout(() => input.current?.focus(), 0)
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex h-11 w-full min-w-0 items-center gap-3 rounded-xl border px-4 text-left text-base shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
            fieldClass,
          )}
        >
          <MapPin aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            {selected?.name ?? "Любой город"}
          </span>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(24rem,60dvh)] w-(--radix-dropdown-menu-trigger-width) min-w-56 overflow-y-auto p-0"
      >
        <div className="sticky top-0 z-10 border-b bg-popover p-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={input}
              type="search"
              aria-label="Поиск города"
              placeholder="Найти город"
              value={query}
              className="h-10 pl-9"
              onChange={(event) => setQuery(event.target.value)}
              // Typing must not trigger the menu's type-ahead or shortcuts.
              onKeyDown={(event) => {
                if (event.key !== "Escape") event.stopPropagation()
              }}
            />
          </div>
        </div>
        <div className="p-1">
          {!needle && (
            <DropdownMenuItem
              className="min-h-10"
              onSelect={() => onChange(undefined)}
            >
              Любой город
              {value === undefined && <Check aria-hidden className="ml-auto" />}
            </DropdownMenuItem>
          )}
          {shown.map((option) => (
            <DropdownMenuItem
              key={option.code}
              className="min-h-10"
              onSelect={() => onChange(option.code)}
            >
              {option.name}
              {value === option.code && (
                <Check aria-hidden className="ml-auto" />
              )}
            </DropdownMenuItem>
          ))}
          {!shown.length && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
