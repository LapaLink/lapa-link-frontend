"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FilePen, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ApiError, casesApi, getErrorMessage } from "@/api"
import { ROUTES } from "@/lib/constants"
import { invalidateCaseData } from "@/lib/queryKeys"
import { FormAlert, LoadingButton, SectionCard } from "@/components/common"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/ui"

/**
 * Author's banner on a draft: publish it (OPEN, or PENDING_REVIEW with
 * premoderation) or delete it with its photos and needs.
 */
export function DraftActions({ caseId }: { caseId: string }) {
  const client = useQueryClient()
  const router = useRouter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")
  // UNKNOWN_CITY: the city has to be changed in the edit form first.
  const [cityGone, setCityGone] = useState(false)

  const publish = useMutation({
    mutationFn: () => casesApi.publish(caseId),
    onSuccess: (published) => {
      toast.success(
        published.status === "PENDING_REVIEW"
          ? "Объявление отправлено на модерацию"
          : "Объявление опубликовано",
      )
      void invalidateCaseData(client, caseId)
    },
    onError: (cause) => {
      const code = cause instanceof ApiError ? cause.code : undefined
      if (code === "CASE_NOT_DRAFT") {
        toast.info("Объявление уже опубликовано")
        void invalidateCaseData(client, caseId)
      } else if (code === "UNKNOWN_CITY") {
        setCityGone(true)
        setError("Город больше не поддерживается, выберите другой.")
      } else setError(getErrorMessage(cause, "Не удалось опубликовать."))
    },
  })
  const remove = useMutation({
    mutationFn: () => casesApi.deleteDraft(caseId),
    onSuccess: () => {
      toast.success("Черновик удалён")
      setConfirmDelete(false)
      void client.invalidateQueries({ queryKey: ["account", "cases"] })
      router.replace(`${ROUTES.MY_CASES}#drafts`)
    },
    onError: (cause) => {
      setConfirmDelete(false)
      if (cause instanceof ApiError && cause.code === "CASE_NOT_DRAFT") {
        toast.info("Объявление уже опубликовано, удалить его нельзя")
        void invalidateCaseData(client, caseId)
      } else toast.error(getErrorMessage(cause, "Не удалось удалить черновик."))
    },
  })
  const busy = publish.isPending || remove.isPending

  return (
    <SectionCard
      icon={FilePen}
      title="Черновик — виден только вам"
      description="Его нет в ленте и на карте, уведомления по нему не рассылаются. Дополните объявление и опубликуйте, когда будете готовы."
    >
      <FormAlert message={error} />
      {cityGone && (
        <Link
          href={ROUTES.EDIT_CASE(caseId)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Изменить город
        </Link>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <LoadingButton
          className="h-11 sm:h-10"
          loading={publish.isPending}
          loadingText="Публикуем…"
          disabled={busy}
          onClick={() => {
            setError("")
            setCityGone(false)
            publish.mutate()
          }}
        >
          <Send aria-hidden />
          Опубликовать
        </LoadingButton>
        <Button
          variant="outline"
          className="h-11 text-destructive sm:h-10"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 aria-hidden />
          Удалить черновик
        </Button>
      </div>
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !remove.isPending && setConfirmDelete(open)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить черновик?</AlertDialogTitle>
            <AlertDialogDescription>
              Черновик будет удалён вместе с фото и потребностями. Восстановить
              его будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                // Stay open until the request ends.
                event.preventDefault()
                remove.mutate()
              }}
            >
              {remove.isPending ? "Удаляем…" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
