"use client"

import { useEffect, useId, useState } from "react"
import Cropper, { type Area } from "react-easy-crop"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Slider,
  Field,
  FieldLabel,
} from "@/components/ui"
import { FormAlert } from "../FormAlert/FormAlert"
import { LoadingButton } from "../LoadingButton/LoadingButton"
import { cropImage } from "@/lib/images"

type ImageCropDialogProps = {
  file: File
  onClose: () => void
  onSave: (file: File) => Promise<void>
  shape: "round" | "rect"
  onReturnFocus: () => void
}

export function ImageCropDialog({
  file,
  onClose,
  onSave,
  shape,
  onReturnFocus,
}: ImageCropDialogProps) {
  const zoomId = useId()
  const [source, setSource] = useState("")
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const reader = new FileReader()
    reader.onload = () => setSource(String(reader.result))
    reader.onerror = () =>
      setError("Не удалось открыть фото. Выберите другое изображение.")
    reader.readAsDataURL(file)
    return () => reader.abort()
  }, [file])

  async function save() {
    if (!area || busy) return
    setBusy(true)
    setError("")
    try {
      await onSave(
        await cropImage(
          source,
          area,
          shape === "round" ? 512 : 1024,
          shape === "round" ? "avatar.png" : "animal.png",
        ),
      )
      onClose()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить фото. Попробуйте ещё раз.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md data-open:zoom-in-100 data-closed:zoom-out-100"
        showCloseButton={!busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onReturnFocus()
        }}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>Настроить фото</DialogTitle>
          <DialogDescription>
            {shape === "round"
              ? "Передвиньте фото и выберите масштаб. В круге — ваша будущая аватарка."
              : "Передвиньте фото и выберите масштаб. В квадрате — фото для объявления."}
          </DialogDescription>
        </DialogHeader>
        <div
          className="relative h-[min(40dvh,320px)] min-h-40 overflow-hidden rounded-xl bg-muted"
          aria-label="Область обрезки фото"
        >
          {source && (
            <Cropper
              image={source}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape={shape}
              showGrid={shape === "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
              onMediaLoaded={() => setError("")}
              mediaProps={{
                onError: () => {
                  setArea(null)
                  setError(
                    "Не удалось открыть фото. Выберите другое изображение.",
                  )
                },
              }}
            />
          )}
          {busy && <div className="absolute inset-0 bg-background/50" />}
        </div>
        <Field>
          <FieldLabel htmlFor={zoomId}>Масштаб</FieldLabel>
          <Slider
            id={zoomId}
            aria-label="Масштаб фото"
            min={1}
            max={3}
            step={0.01}
            value={[zoom]}
            onValueChange={([value]) => setZoom(value)}
            disabled={busy}
            className="min-h-11"
          />
        </Field>
        {file.type === "image/gif" && (
          <p className="text-sm text-muted-foreground">
            Сохраним неподвижный кадр из GIF.
          </p>
        )}
        <FormAlert message={error} />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy}
            onClick={onClose}
          >
            Отмена
          </Button>
          <LoadingButton
            type="button"
            size="lg"
            loading={busy}
            loadingText="Сохраняем…"
            disabled={!area}
            onClick={() => void save()}
          >
            Сохранить
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
