import { Skeleton } from "@/components/ui"

export function AccountSkeleton() {
  return (
    <section
      role="status"
      aria-label="Загружаем ваш профиль…"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <span className="sr-only">Загружаем ваш профиль…</span>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 sm:p-6">
            <div className="flex items-center gap-5">
              <Skeleton className="size-24 rounded-full" />
              <Skeleton className="h-7 w-40" />
            </div>
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-full" />
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
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
