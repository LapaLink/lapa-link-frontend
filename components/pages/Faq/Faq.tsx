"use client"

import { useEffect, useState, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import { CircleHelp, CloudOff, Link2, Search } from "lucide-react"
import { faqApi, getErrorMessage } from "@/api"
import { useDictionaryLocale } from "@/hooks"
import { EmptyState, FormAlert, PageHeader } from "@/components/common"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Input,
  Skeleton,
} from "@/components/ui"

const ANCHOR_PREFIX = "faq-"

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

/**
 * Public FAQ in the interface language (refetched when it changes): an
 * accordion with a client-side search; `#faq-{id}` opens and scrolls to a
 * question so it can be linked to.
 */
export function Faq() {
  const locale = useDictionaryLocale()
  const faq = useQuery({
    queryKey: ["faq", locale],
    queryFn: ({ signal }) => faqApi.list(signal),
  })
  const [search, setSearch] = useState("")
  const hash = useSyncExternalStore(
    subscribeHash,
    () => decodeURIComponent(window.location.hash.slice(1)),
    () => "",
  )
  const linked = hash.startsWith(ANCHOR_PREFIX)
    ? hash.slice(ANCHOR_PREFIX.length)
    : ""
  const [open, setOpen] = useState<string[]>([])
  const openIds = linked && !open.includes(linked) ? [...open, linked] : open

  useEffect(() => {
    if (linked && faq.data)
      document
        .getElementById(`${ANCHOR_PREFIX}${linked}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [linked, faq.data])

  const query = search.trim().toLowerCase()
  const items = (faq.data ?? []).filter(
    (item) =>
      !query ||
      item.question.toLowerCase().includes(query) ||
      item.answer.toLowerCase().includes(query),
  )

  return (
    <section className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 sm:gap-6">
      <PageHeader
        eyebrow="Помощь"
        title="Частые вопросы"
        description="Как устроен сервис, как помочь животным и как подать объявление."
      />
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Поиск по вопросам"
          placeholder="Поиск по вопросам и ответам"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
        />
      </div>
      {faq.isPending ? (
        <div
          role="status"
          aria-label="Загружаем вопросы"
          className="flex flex-col gap-3"
        >
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-14 rounded-2xl" />
          ))}
        </div>
      ) : faq.isError ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить вопросы">
          <FormAlert
            message={getErrorMessage(
              faq.error,
              "Не удалось загрузить вопросы.",
            )}
          />
          <Button variant="outline" onClick={() => void faq.refetch()}>
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !faq.data.length ? (
        <EmptyState icon={CircleHelp} title="Вопросов пока нет" />
      ) : !items.length ? (
        <EmptyState
          icon={Search}
          title="Ничего не нашлось"
          description="Попробуйте другие слова."
        />
      ) : (
        <Accordion
          type="multiple"
          value={openIds}
          onValueChange={setOpen}
          className="rounded-2xl border bg-card px-4 sm:px-6"
        >
          {items.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              id={`${ANCHOR_PREFIX}${item.id}`}
              className="scroll-mt-24"
            >
              <AccordionTrigger className="text-left font-semibold [overflow-wrap:anywhere]">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="flex flex-col items-start gap-3">
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80 [overflow-wrap:anywhere]">
                  {item.answer}
                </p>
                {/* A plain anchor: the page follows the hash on hashchange. */}
                <a
                  href={`#${ANCHOR_PREFIX}${item.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Link2 aria-hidden className="size-3.5" />
                  Ссылка на вопрос
                </a>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </section>
  )
}
