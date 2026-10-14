"use client"

import { useRef, useState } from "react"
import { Camera, Trash2 } from "lucide-react"
import { useUploadAvatar, useDeleteAvatar, useTransientNotice } from "@/hooks"
import {
  FormAlert,
  LoadingButton,
  SectionCard,
  UserAvatar,
} from "@/components/common"
import type { CurrentUser } from "@/types"
import { AVATAR_ACCEPT, avatarSchema } from "../schemas"
import { AvatarCropDialog } from "./AvatarCropDialog"

export function AvatarCard({ user }: { user: CurrentUser }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useUploadAvatar()
  const remove = useDeleteAvatar()
  const [error, setError] = useState("")
  const [notice, setNotice] = useTransientNotice()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const busy = upload.isPending || remove.isPending

  function selectPhoto(file: File | undefined) {
    if (!file || busy) return
    setError("")
    setNotice("")
    const result = avatarSchema.safeParse(file)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }
    setSelectedFile(file)
  }

  async function uploadPhoto(file: File) {
    await upload.mutateAsync(file)
    setNotice("Фото обновлено.")
  }

  async function deletePhoto() {
    if (busy) return
    setError("")
    setNotice("")
    try {
      await remove.mutateAsync(undefined)
      setNotice("Фото удалено.")
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось удалить фото. Попробуйте ещё раз.",
      )
    }
  }

  return (
    <SectionCard
      icon={Camera}
      title="Фото профиля"
      description="С фото вас будет проще узнать."
      fullWidthBody
    >
      <div aria-busy={busy} className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
          <UserAvatar user={user} size="profile" />
          <div className="flex w-full min-w-0 flex-col gap-3">
            <p className="text-center text-sm text-muted-foreground sm:text-left">
              JPEG, PNG, GIF или WEBP, до 5 МБ.
            </p>
            <input
              ref={fileInput}
              type="file"
              accept={AVATAR_ACCEPT}
              aria-label="Фото профиля"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ""
                selectPhoto(file)
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <LoadingButton
                type="button"
                size="lg"
                className="rounded-full"
                disabled={busy}
                loading={upload.isPending}
                loadingText="Загружаем…"
                onClick={() => fileInput.current?.click()}
                data-avatar-upload
              >
                <Camera data-icon="inline-start" />
                {user.avatarUrl ? "Сменить фото" : "Загрузить фото"}
              </LoadingButton>
              {user.avatarUrl && (
                <LoadingButton
                  type="button"
                  size="lg"
                  variant="outline"
                  className="rounded-full"
                  disabled={busy}
                  loading={remove.isPending}
                  loadingText="Удаляем…"
                  onClick={() => void deletePhoto()}
                >
                  <Trash2 data-icon="inline-start" />
                  Удалить фото
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
        <FormAlert message={error} />
        {notice && (
          <p role="status" className="text-sm text-success-foreground">
            {notice}
          </p>
        )}
        {selectedFile && (
          <AvatarCropDialog
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
            onSave={uploadPhoto}
          />
        )}
      </div>
    </SectionCard>
  )
}
