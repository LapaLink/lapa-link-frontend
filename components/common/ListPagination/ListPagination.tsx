import { Button } from "@/components/ui"

export function ListPagination({
  page,
  totalPages,
  busy,
  onPageChange,
}: {
  page: number
  totalPages: number
  busy?: boolean
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label="Страницы объявлений"
      className="flex items-center justify-center gap-2 sm:gap-4"
    >
      <Button
        variant="outline"
        disabled={page === 0 || busy}
        onClick={() => onPageChange(page - 1)}
      >
        Назад
      </Button>
      <span className="text-center text-sm" aria-live="polite">
        {page + 1} из {totalPages}
      </span>
      <Button
        variant="outline"
        disabled={page >= totalPages - 1 || busy}
        onClick={() => onPageChange(page + 1)}
      >
        Далее
      </Button>
    </nav>
  )
}
