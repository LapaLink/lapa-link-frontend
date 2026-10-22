"use client"

import Image from "next/image"
import { useState } from "react"
import { cn } from "cn"
import { normalizeRemoteImageUrl } from "@/lib/images"
import type { CaseGalleryPhoto } from "@/types"
import { CasePhoto } from "@/components/common"

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
  const index = Math.max(
    0,
    photos.findIndex((photo) => photo.id === selectedId),
  )
  const current = photos[index]
  if (!current) return null
  return (
    <section
      aria-label="Фото животного"
      className="flex flex-col gap-3 overflow-hidden rounded-2xl border bg-card p-3 sm:p-4"
    >
      <div className="overflow-hidden rounded-xl bg-muted">
        <CasePhoto
          key={current.id}
          src={current.url}
          alt={`${title}, фото ${index + 1} из ${photos.length}`}
          aspect="aspect-[4/3] sm:aspect-video"
          priority={index === 0}
        />
      </div>
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
    </section>
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
