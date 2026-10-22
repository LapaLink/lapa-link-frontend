"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Star,
  Trash2,
} from "lucide-react"
import { ApiError, casesApi, getErrorMessage } from "@/api"
import { normalizeRemoteImageUrl, prepareCasePhotos } from "@/lib/images"
import { invalidateCaseData, queryKeys } from "@/lib/queryKeys"
import { CASE_PHOTOS_MAX, IMAGE_ACCEPT } from "@/lib/validation"
import type { CaseDetails, CaseGalleryPhoto } from "@/types"
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

// The gallery changed elsewhere (another tab): reload it before retrying.
const STALE_GALLERY = ["INVALID_CASE_PHOTO_ORDER", "CASE_PHOTO_NOT_FOUND"]

/**
 * Author's gallery editor: add, delete, reorder and pick the cover (the
 * first photo). Every change goes to the server at once and the gallery from
 * its response replaces the local one; positions are never computed here.
 */
export function CaseGalleryEditor({
  caseId,
  photos,
}: {
  caseId: string
  photos: readonly CaseGalleryPhoto[]
}) {
  const client = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [removing, setRemoving] = useState<CaseGalleryPhoto | null>(null)
  const full = photos.length >= CASE_PHOTOS_MAX

  async function run(label: string, action: () => Promise<CaseGalleryPhoto[]>) {
    setBusy(label)
    setError("")
    try {
      const gallery = await action()
      client.setQueryData<CaseDetails>(
        queryKeys.caseDetail(caseId),
        (current) =>
          current && {
            ...current,
            photos: gallery,
            photoUrl: gallery[0]?.url ?? null,
          },
      )
      // Lists show the cover (photoUrl), refresh them too.
      void invalidateCaseData(client, caseId)
      return true
    } catch (actionError) {
      setError(getErrorMessage(actionError, "Не удалось изменить фото."))
      if (
        actionError instanceof ApiError &&
        STALE_GALLERY.includes(actionError.code ?? "")
      )
        void client.invalidateQueries({
          queryKey: queryKeys.caseDetail(caseId),
        })
      return false
    } finally {
      setBusy(null)
    }
  }

  async function add(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!selected.length) return
    setBusy("add")
    const { files, error: skipped } = await prepareCasePhotos(
      selected,
      CASE_PHOTOS_MAX - photos.length,
    )
    if (files.length) await run("add", () => casesApi.addPhotos(caseId, files))
    else setBusy(null)
    if (skipped) setError((current) => current || skipped)
  }

  const reorder = (label: string, ids: string[]) =>
    void run(label, () => casesApi.reorderPhotos(caseId, ids))
  const move = (index: number, to: number) => {
    const ids = photos.map((photo) => photo.id)
    ids.splice(to, 0, ...ids.splice(index, 1))
    reorder(`move-${photos[index].id}`, ids)
  }

  return (
    <SectionCard
      icon={Images}
      title="Фото"
      description={`До ${CASE_PHOTOS_MAX} фото. Первое — обложка: его видно в ленте и в карточках.`}
      fullWidthBody
    >
      {photos.length > 0 ? (
        <ul
          aria-busy={!!busy}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {photos.map((photo, index) => {
            const source = normalizeRemoteImageUrl(photo.url)
            const label = `фото ${index + 1}`
            return (
              <li
                key={photo.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
              >
                <div className="relative aspect-[4/3] bg-muted">
                  {source && (
                    <Image
                      src={source}
                      alt={`Фото ${index + 1}`}
                      width={320}
                      height={240}
                      className="size-full object-cover"
                    />
                  )}
                  {index === 0 && (
                    <span className="absolute top-2 left-2 rounded-lg bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                      Обложка
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 p-1">
                  {index > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-11 sm:size-9"
                      aria-label={`Сделать ${label} обложкой`}
                      title="Сделать обложкой"
                      disabled={!!busy}
                      onClick={() =>
                        reorder(`cover-${photo.id}`, [
                          photo.id,
                          ...photos
                            .filter((item) => item.id !== photo.id)
                            .map((item) => item.id),
                        ])
                      }
                    >
                      <Star aria-hidden />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-9"
                    aria-label={`Сдвинуть ${label} левее`}
                    title="Левее"
                    disabled={!!busy || index === 0}
                    onClick={() => move(index, index - 1)}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 sm:size-9"
                    aria-label={`Сдвинуть ${label} правее`}
                    title="Правее"
                    disabled={!!busy || index === photos.length - 1}
                    onClick={() => move(index, index + 1)}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-11 text-destructive hover:text-destructive sm:size-9"
                    aria-label={`Удалить ${label}`}
                    title="Удалить"
                    disabled={!!busy}
                    onClick={() => setRemoving(photo)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Фото пока нет. С фото объявление заметнее.
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void add(event)}
      />
      <LoadingButton
        type="button"
        variant="outline"
        className="h-11 self-start sm:h-10"
        loading={busy === "add"}
        loadingText="Загружаем…"
        disabled={full || !!busy}
        onClick={() => fileInput.current?.click()}
      >
        <ImagePlus aria-hidden />
        {full
          ? `Добавлено ${CASE_PHOTOS_MAX} из ${CASE_PHOTOS_MAX}`
          : `Добавить фото (${photos.length} из ${CASE_PHOTOS_MAX})`}
      </LoadingButton>
      <FormAlert message={error} />

      <AlertDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить фото?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && photos[0]?.id === removing.id && photos.length > 1
                ? "Это обложка — её место займёт следующее фото."
                : "Фото пропадёт из объявления."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing)
                  void run(`delete-${removing.id}`, () =>
                    casesApi.deletePhoto(caseId, removing.id),
                  )
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionCard>
  )
}
