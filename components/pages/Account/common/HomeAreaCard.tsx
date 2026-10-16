"use client"

import { useState } from "react"
import { MapPin, MapPinned } from "lucide-react"
import { useTransientNotice } from "@/hooks"
import type { CurrentUser } from "@/types"
import { LoadingButton, SectionCard } from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui"
import { useHomePoint } from "../hooks/useHomePoint"
import { HomeAreaPicker } from "./HomeAreaPicker"

/**
 * "Мой район": the home point that help offer radii are measured from. It is
 * stored in the profile and visible to the owner only. Without it matching
 * falls back to the profile city and ignores the radius. The map opens in a
 * dialog, so Leaflet loads only when the user wants to change the point.
 */
export function HomeAreaCard({ user }: { user: CurrentUser }) {
  const home = useHomePoint(user)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useTransientNotice()

  async function save() {
    if (await home.save()) {
      setOpen(false)
      setNotice(home.draft ? "Точка сохранена" : "Точка удалена")
    }
  }

  return (
    <SectionCard
      icon={MapPinned}
      title="Мой район"
      description="Нужна, чтобы присылать потребности в пределах вашего радиуса. Другим пользователям не видна."
      fullWidthBody
    >
      <p className="flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        {home.saved
          ? "Домашняя точка задана."
          : "Точка не задана: подбираем потребности по городу профиля без учёта радиуса."}
      </p>
      {notice && (
        <p role="status" className="text-sm text-success-foreground">
          {notice}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full sm:h-10 sm:w-fit"
        onClick={() => {
          home.reset()
          setNotice("")
          setOpen(true)
        }}
      >
        <MapPinned aria-hidden />
        {home.saved ? "Изменить местоположение" : "Задать местоположение"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!home.saving) setOpen(next)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Мой район</DialogTitle>
            <DialogDescription>
              {home.draft
                ? "Нажмите на карту, чтобы перенести точку."
                : "Нажмите на карту, чтобы поставить точку."}
            </DialogDescription>
          </DialogHeader>
          <HomeAreaPicker user={user} home={home} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={home.saving}
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <LoadingButton
              type="button"
              loading={home.saving}
              loadingText="Сохраняем…"
              disabled={!home.dirty}
              onClick={() => void save()}
            >
              {home.draft ? "Сохранить точку" : "Сохранить без точки"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
