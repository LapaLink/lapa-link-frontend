import { Skeleton } from "@/components/ui"

export function AccountSkeleton() {
  return (
    <section
      role="status"
      aria-label="Загружаем ваш профиль…"
      className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8"
    >
      <span className="sr-only">Загружаем ваш профиль…</span>
      <div
        aria-hidden="true"
        className="flex gap-2 rounded-2xl border bg-card p-2 lg:flex-col lg:self-start lg:p-4"
      >
        <div className="hidden items-center gap-3 pb-2 lg:flex">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-5 w-24" />
        </div>
        {[0, 1, 2, 3, 4].map((key) => (
          <Skeleton key={key} className="h-10 w-28 rounded-xl lg:w-full" />
        ))}
      </div>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-5 w-3/4" />
        </div>
        <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6 lg:flex-row lg:items-center">
          <div className="flex items-center gap-5">
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-10 flex-1 rounded-lg" />
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6"
            >
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
