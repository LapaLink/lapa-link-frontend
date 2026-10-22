"use client"

import { useEffect, useRef, useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { Camera, Crop, ImagePlus, Star, Trash2 } from "lucide-react"
import Image from "next/image"
import { prepareCasePhotos } from "@/lib/images"
import { CASE_PHOTOS_MAX, IMAGE_ACCEPT, imageSchema } from "@/lib/validation"
import { ImageCropDialog } from "@/components/common"
import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Skeleton,
} from "@/components/ui"
import type { CreateCaseValues } from "../schemas"

/** Preview of a picked file; read as a data URL, like the old single photo field. */
function LocalPhoto({ file, alt }: { file: File; alt: string }) {
  const [preview, setPreview] = useState<{ file: File; url: string }>()
  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setPreview({ file, url: String(reader.result) })
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])
  return preview?.file === file ? (
    <Image
      src={preview.url}
      alt={alt}
      width={320}
      height={240}
      unoptimized
      className="aspect-[4/3] w-full object-cover"
    />
  ) : (
    <Skeleton className="aspect-[4/3] w-full rounded-none" />
  )
}

/**
 * Gallery for a new case: up to CASE_PHOTOS_MAX photos, the first is the
 * cover. Files are checked and large ones scaled down before they are added.
 */
export function PhotosField() {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext<CreateCaseValues>()
  const photos = useWatch({ control, name: "photos" }) ?? []
  const [cropIndex, setCropIndex] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  // Skipped files are reported here, not as a form error: the photos that
  // passed are fine and must not block publishing.
  const [skipped, setSkipped] = useState("")
  const addButton = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const full = photos.length >= CASE_PHOTOS_MAX
  const error =
    errors.photos?.message ?? errors.photos?.root?.message ?? skipped

  const save = (next: File[]) =>
    setValue("photos", next, { shouldValidate: true, shouldDirty: true })

  async function add(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (!selected.length) return
    setAdding(true)
    const { files, error } = await prepareCasePhotos(
      selected,
      CASE_PHOTOS_MAX - photos.length,
    )
    setAdding(false)
    save([...photos, ...files])
    setSkipped(error)
  }

  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="photos">
        <Camera className="size-4" /> Фото животного
      </FieldLabel>
      <FieldDescription>
        До {CASE_PHOTOS_MAX} фото в формате JPEG, PNG, GIF или WEBP, до 5 МБ
        каждое. Первое станет обложкой. Можно добавить позже.
      </FieldDescription>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
            >
              <div className="relative bg-muted">
                <LocalPhoto file={file} alt={`Фото ${index + 1}`} />
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
                    aria-label={`Сделать фото ${index + 1} обложкой`}
                    title="Сделать обложкой"
                    onClick={() =>
                      save([file, ...photos.filter((_, i) => i !== index)])
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
                  aria-label={`Обрезать фото ${index + 1}`}
                  title="Обрезать"
                  onClick={() => setCropIndex(index)}
                >
                  <Crop aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto size-11 text-destructive hover:text-destructive sm:size-9"
                  aria-label={`Удалить фото ${index + 1}`}
                  title="Удалить"
                  onClick={() => {
                    setSkipped("")
                    save(photos.filter((_, i) => i !== index))
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Input
        ref={fileInput}
        className="hidden"
        tabIndex={-1}
        id="photos"
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        aria-invalid={!!error}
        aria-describedby="photos-error"
        onChange={(event) => void add(event)}
      />
      <Input
        ref={cameraInput}
        className="hidden"
        tabIndex={-1}
        type="file"
        accept="image/*"
        capture="environment"
        aria-hidden
        onChange={(event) => void add(event)}
      />
      {/* Camera capture only makes sense on touch devices with a camera. */}
      <div className="hidden flex-col pointer-coarse:flex">
        <Button
          type="button"
          size="lg"
          disabled={full || adding}
          onClick={() => cameraInput.current?.click()}
        >
          <Camera data-icon="inline-start" />
          Сфотографировать
        </Button>
      </div>
      <Button
        ref={addButton}
        type="button"
        variant="outline"
        size="lg"
        disabled={full || adding}
        onClick={() => fileInput.current?.click()}
      >
        <ImagePlus data-icon="inline-start" />
        {adding
          ? "Готовим фото…"
          : photos.length
            ? `Добавить ещё (${photos.length} из ${CASE_PHOTOS_MAX})`
            : "Добавить фото"}
      </Button>
      <FieldError id="photos-error">{error}</FieldError>
      {cropIndex !== null && photos[cropIndex] && (
        <ImageCropDialog
          file={photos[cropIndex]}
          shape="rect"
          onClose={() => setCropIndex(null)}
          onReturnFocus={() => addButton.current?.focus()}
          onSave={async (cropped) => {
            const result = imageSchema.safeParse(cropped)
            if (!result.success) throw new Error(result.error.issues[0].message)
            save(photos.map((file, i) => (i === cropIndex ? cropped : file)))
          }}
        />
      )}
    </Field>
  )
}
