"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { CloudOff, Lock } from "lucide-react"
import { casesApi, getErrorMessage } from "@/api"
import { useAuth } from "@/hooks"
import { queryKeys } from "@/lib/queryKeys"
import { ROUTES } from "@/lib/constants"
import {
  EmptyState,
  FormAlert,
  PageHeader,
  RequireAuth,
} from "@/components/common"
import { Button, Card, CardContent, Skeleton } from "@/components/ui"
import { canEditCase } from "./schemas"
import { EditCaseForm } from "./common/EditCaseForm"

function EditSkeleton() {
  return (
    <Card role="status" aria-label="Загружаем объявление">
      <CardContent className="flex flex-col gap-6">
        <Skeleton className="h-8 w-2/3" />
        {[0, 1, 2, 3].map((key) => (
          <Skeleton key={key} className="h-16 w-full rounded-xl" />
        ))}
      </CardContent>
    </Card>
  )
}

export function EditCase({ caseId }: { caseId: string }) {
  return (
    <RequireAuth
      fallback={<EditSkeleton />}
      guestMessage="Войдите, чтобы редактировать своё объявление."
    >
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
    <section className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 sm:gap-6">
      <PageHeader
        back={{ href: ROUTES.CASE_DETAILS(caseId), label: "К объявлению" }}
        title="Редактировать объявление"
        description="Обновите информацию, чтобы людям было проще помочь животному."
      />
      {details.isPending ? (
        <EditSkeleton />
      ) : details.isError ? (
        <EmptyState icon={CloudOff} title="Не получилось загрузить объявление">
          <FormAlert
            message={getErrorMessage(
              details.error,
              "Не удалось загрузить объявление.",
            )}
          />
          <Button
            variant="outline"
            className="h-11 sm:h-10"
            onClick={() => void details.refetch()}
          >
            Попробовать ещё раз
          </Button>
        </EmptyState>
      ) : !canEditCase(details.data, user?.id) ? (
        <EmptyState
          icon={Lock}
          tone="danger"
          title={
            details.data.author.id !== user?.id
              ? "Вы не можете редактировать чужое объявление."
              : "Объявление закрыто. Редактирование недоступно."
          }
        >
          <Button asChild variant="outline" className="h-11 sm:h-10">
            <Link href={ROUTES.CASE_DETAILS(caseId)}>К объявлению</Link>
          </Button>
        </EmptyState>
      ) : (
        <EditCaseForm key={caseId} item={details.data} />
      )}
    </section>
  )
}
