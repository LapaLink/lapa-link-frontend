import { Card, CardContent, Skeleton } from "@/components/ui"

export function CaseCardsSkeleton() {
  return (
    <div
      role="status"
      aria-label="Загружаем объявления"
      className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }, (_, key) => (
        <Card key={key} className="min-w-0 pt-0">
          <Skeleton className="aspect-video w-full" />
          <CardContent className="flex flex-col gap-4">
            <Skeleton className="h-6 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-lg" />
              <Skeleton className="h-6 w-24 rounded-lg" />
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
