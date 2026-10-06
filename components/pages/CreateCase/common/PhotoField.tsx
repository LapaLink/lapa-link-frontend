"use client"

import { useEffect, useRef, useState } from "react"
import { useFormContext, useWatch } from "react-hook-form"
import { Camera, X } from "lucide-react"
import Image from "next/image"
import { IMAGE_ACCEPT, imageSchema } from "@/lib/validation"
import { ImageCropDialog } from "@/components/common"
import {
  Button,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  Input,
} from "@/components/ui"
import type { CreateCaseValues } from "../schemas"

export function PhotoField() {
  const {
    control,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext<CreateCaseValues>()
  const file = useWatch({ control, name: "photo" })
  const [preview, setPreview] = useState("")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const selectButton = useRef<HTMLButtonElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!file || !imageSchema.safeParse(file).success) return
    const reader = new FileReader()
    reader.onload = () => setPreview(String(reader.result))
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])
  return (
    <Field data-invalid={!!errors.photo}>
      <FieldLabel htmlFor="photo">
        <Camera className="size-4" /> Фото животного
      </FieldLabel>
      <FieldDescription>
        Одно фото в формате JPEG, PNG, GIF или WEBP, до 5 МБ. Можно добавить
        позже.
      </FieldDescription>
      {file && preview && (
        <div className="relative overflow-hidden rounded-xl border bg-muted">
          <Image
            src={preview}
            alt="Выбранное фото животного"
            width={800}
            height={600}
            unoptimized
            className="max-h-64 w-full object-contain"
          />
        </div>
      )}
      <Input
        ref={fileInput}
        className="hidden"
        tabIndex={-1}
        id="photo"
        type="file"
        accept={IMAGE_ACCEPT}
        aria-invalid={!!errors.photo}
        aria-describedby="photo-error"
        onChange={(event) => {
          const selected = event.target.files?.[0]
          event.target.value = ""
          if (!selected) return
          const result = imageSchema.safeParse(selected)
          if (!result.success) {
            setError("photo", { message: result.error.issues[0].message })
            return
          }
          clearErrors("photo")
          setSelectedFile(selected)
        }}
      />
      <Button
        ref={selectButton}
        type="button"
        variant="outline"
        size="lg"
        onClick={() => fileInput.current?.click()}
      >
        <Camera data-icon="inline-start" />
        {file ? "Выбрать другое фото" : "Добавить фото"}
      </Button>
      {file && (
        <FieldDescription className="break-all">{file.name}</FieldDescription>
      )}
      {(file || errors.photo) && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setValue("photo", undefined, { shouldValidate: true })
            clearErrors("photo")
            setPreview("")
          }}
        >
          <X data-icon="inline-start" />
          {file ? "Убрать фото" : "Продолжить без фото"}
        </Button>
      )}
      <FieldError id="photo-error">{errors.photo?.message}</FieldError>
      {selectedFile && (
        <ImageCropDialog
          file={selectedFile}
          shape="rect"
          onClose={() => setSelectedFile(null)}
          onReturnFocus={() => selectButton.current?.focus()}
          onSave={async (cropped) => {
            const result = imageSchema.safeParse(cropped)
            if (!result.success) throw new Error(result.error.issues[0].message)
            setPreview("")
            setValue("photo", cropped, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }}
        />
      )}
    </Field>
  )
}
