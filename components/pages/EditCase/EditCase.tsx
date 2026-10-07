"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { casesApi, getErrorMessage } from "@/api"
import { useAuth } from "@/hooks"
import { queryKeys } from "@/lib/queryKeys"
import { ROUTES } from "@/lib/constants"
import { RequireAuth, FormAlert } from "@/components/common"
import { Button, Card, CardContent, Skeleton } from "@/components/ui"
import { canEditCase } from "./schemas"
import { EditCaseForm } from "./common/EditCaseForm"

function EditSkeleton() {
  return (
    <Card role="status" aria-label="Загружаем объявление">
      <CardContent className="flex flex-col gap-6">
        <Skeleton className="h-8 w-2/3" />
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-16 w-full" />
        ))}
      </CardContent>
    </Card>
  )
}

export function EditCase({ caseId }: { caseId: string }) {
  return (
    <RequireAuth fallback={<EditSkeleton />}>
      <EditCaseContent caseId={caseId} />
    </RequireAuth>
  )
}

function EditCaseContent({ caseId }: { caseId: string }) {
  const { user } = useAuth()
  const details = useQuery({
    queryKey: queryKeys.caseDetail(caseId),
    queryFn: ({ signal }) => casesApi.getById(caseId, signal),
  })
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Редактировать объявление
        </h1>
        <p className="text-muted-foreground">
          Обновите информацию, чтобы людям было проще помочь животному.
        </p>
      </div>
      {details.isPending ? (
        <EditSkeleton />
      ) : details.isError ? (
        <div className="flex flex-col items-start gap-3">
          <FormAlert
            message={getErrorMessage(
              details.error,
              "Не удалось загрузить объявление.",
            )}
          />
          <Button variant="outline" onClick={() => void details.refetch()}>
            Попробовать ещё раз
          </Button>
        </div>
      ) : !canEditCase(details.data, user?.id) ? (
        <>
          <FormAlert
            message={
              details.data.author.id !== user?.id
                ? "Вы не можете редактировать чужое объявление."
                : "Объявление закрыто. Редактирование недоступно."
            }
          />
          <Button asChild variant="outline">
            <Link href={ROUTES.CASE_DETAILS(caseId)}>К объявлению</Link>
          </Button>
        </>
      ) : (
        <EditCaseForm key={caseId} item={details.data} />
      )}
    </section>
  )
}
