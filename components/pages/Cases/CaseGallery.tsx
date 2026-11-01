"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "cn"
import { normalizeRemoteImageUrl } from "@/lib/images"
import type { CaseGalleryPhoto } from "@/types"
import { CasePhoto } from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Skeleton,
} from "@/components/ui"

/**
 * Read-only gallery of a case: the selected photo large, thumbnails below.
 * The first photo is the cover and is shown first.
 */
export function CaseGallery({
  photos,
  title,
}: {
  photos: readonly CaseGalleryPhoto[]
  title: string
}) {
  const [selectedId, setSelectedId] = useState(photos[0]?.id)
  const [open, setOpen] = useState(false)
  const photoButton = useRef<HTMLButtonElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const index = Math.max(
    0,
    photos.findIndex((photo) => photo.id === selectedId),
  )
  const current = photos[index]
  const move = (delta: number) => {
    if (photos.length)
      setSelectedId(photos[(index + delta + photos.length) % photos.length].id)
  }
  const swipe = {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      pointer.current = { x: event.clientX, y: event.clientY }
      swiped.current = false
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (!pointer.current) return
      const dx = event.clientX - pointer.current.x
      const dy = event.clientY - pointer.current.y
      pointer.current = null
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        swiped.current = true
        move(dx < 0 ? 1 : -1)
      }
    },
    onPointerCancel: () => {
      pointer.current = null
    },
    onDragStart: (event: React.DragEvent) => event.preventDefault(),
  }
  if (!current) return null
  return (
    <section
      aria-label="Фото животного"
      className="flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-3 sm:p-4"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault()
          event.stopPropagation()
          move(event.key === "ArrowLeft" ? -1 : 1)
        }
      }}
    >
      <button
        ref={photoButton}
        type="button"
        aria-label={`Открыть фото ${index + 1} из ${photos.length} на весь экран`}
        className="touch-pan-y overflow-hidden rounded-xl bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring"
        {...swipe}
        onClick={() => {
          if (!swiped.current) setOpen(true)
        }}
      >
        <CasePhoto
          key={current.id}
          src={current.url}
          alt={`${title}, фото ${index + 1} из ${photos.length}`}
          aspect="aspect-[4/3] sm:aspect-video"
          priority={index === 0}
        />
      </button>
      <GalleryControls total={photos.length} index={index} onMove={move} />
      {photos.length > 1 && (
        <div className="flex items-center gap-3">
          <ul className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            {photos.map((photo, photoIndex) => {
              const source = normalizeRemoteImageUrl(photo.url)
              const selected = photoIndex === index
              return (
                <li key={photo.id} className="shrink-0">
                  <button
                    type="button"
                    aria-label={`Показать фото ${photoIndex + 1}`}
                    aria-current={selected || undefined}
                    onClick={() => setSelectedId(photo.id)}
                    className={cn(
                      "block size-16 overflow-hidden rounded-lg border-2 bg-muted outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 sm:size-20",
                      selected
                        ? "border-primary"
                        : "border-transparent opacity-80 hover:opacity-100",
                    )}
                  >
                    {source && (
                      <Image
                        src={source}
                        alt=""
                        width={160}
                        height={160}
                        className="size-full object-cover"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
          <p
            className="shrink-0 text-sm text-muted-foreground"
            aria-live="polite"
          >
            {index + 1} из {photos.length}
          </p>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            photoButton.current?.focus()
          }}
          className="inset-0! flex h-dvh w-screen max-w-none! translate-x-0! translate-y-0! flex-col gap-3 rounded-none! p-0! sm:max-w-none! [&>[data-slot=dialog-close]]:top-[max(.5rem,env(safe-area-inset-top))]"
        >
          <DialogHeader className="shrink-0 pt-[max(1rem,env(safe-area-inset-top))] pr-14 pl-[max(1rem,env(safe-area-inset-left))]">
            <DialogTitle className="truncate">{title}</DialogTitle>
            <DialogDescription>
              Фото животного. Листайте свайпом или стрелками.
            </DialogDescription>
          </DialogHeader>
          <div
            className="relative min-h-0 flex-1 touch-pan-y select-none"
            {...swipe}
          >
            <GalleryImage key={current.id} photo={current} title={title} />
          </div>
          <div className="shrink-0 px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))]">
            <GalleryControls
              total={photos.length}
              index={index}
              onMove={move}
            />
          </div>
          {photos.length > 1 && (
            <Image
              src={
                normalizeRemoteImageUrl(
                  photos[(index + 1) % photos.length].url,
                ) || "/lapalink-logo.png"
              }
              alt=""
              aria-hidden
              width={1600}
              height={1200}
              sizes="100vw"
              loading="eager"
              className="hidden"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function GalleryControls({
  total,
  index,
  onMove,
}: {
  total: number
  index: number
  onMove: (delta: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Предыдущее фото"
        disabled={total < 2}
        onClick={() => onMove(-1)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <p role="status" aria-live="polite" className="text-sm font-semibold">
        {index + 1} / {total}
      </p>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-11"
        aria-label="Следующее фото"
        disabled={total < 2}
        onClick={() => onMove(1)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  )
}

function GalleryImage({
  photo,
  title,
}: {
  photo: CaseGalleryPhoto
  title: string
}) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const source = normalizeRemoteImageUrl(photo.url)
  return (
    <>
      {loading && <Skeleton className="absolute inset-0 rounded-none" />}
      {source && !failed ? (
        <Image
          src={source}
          alt={title}
          fill
          sizes="100vw"
          loading="eager"
          className="object-contain"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setFailed(true)
          }}
        />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-muted-foreground">
          Не удалось загрузить фото. Попробуйте открыть его позже.
        </p>
      )}
    </>
  )
}

/** Gallery of case details; falls back to the cover for responses without `photos`. */
export function galleryOf(details: {
  photos?: CaseGalleryPhoto[]
  photoUrl?: string | null
}): CaseGalleryPhoto[] {
  if (details.photos) return details.photos
  return details.photoUrl
    ? [{ id: "cover", url: details.photoUrl, position: 0 }]
    : []
}
