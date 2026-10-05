import { Skeleton } from "@/components/ui"

export function AccountSkeleton() {
  return (
    <section
      role="status"
      aria-label="Загружаем ваш профиль…"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8"
    >
      <span className="sr-only">Загружаем ваш профиль…</span>
      <div aria-hidden="true" className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2">
          <div className="flex flex-col gap-5 rounded-xl border p-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="mx-auto size-24 rounded-full" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-5 rounded-xl border p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  )
}
