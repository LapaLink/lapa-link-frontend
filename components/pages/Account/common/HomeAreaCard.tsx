"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { LocateFixed, MapPin, MapPinned, X } from "lucide-react"
import { getErrorMessage } from "@/api"
import { useCities, useTransientNotice, useUpdateProfile } from "@/hooks"
import type { CurrentUser } from "@/types"
import { FormAlert, LoadingButton, SectionCard } from "@/components/common"
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from "@/components/ui"
import type { HomePoint } from "./HomeAreaMap"

const HomeAreaMap = dynamic(() => import("./HomeAreaMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl sm:h-72" />,
})

// ~1 m: enough for a radius in kilometres.
const round = (value: number) => Math.round(value * 1e5) / 1e5

function savedPoint(user: CurrentUser): HomePoint | null {
  return user.homeLatitude != null && user.homeLongitude != null
    ? { latitude: user.homeLatitude, longitude: user.homeLongitude }
    : null
}

const geolocationErrors: Record<number, string> = {
  1: "Нет доступа к геолокации. Разрешите его в браузере или выберите точку на карте.",
  2: "Не удалось определить местоположение. Выберите точку на карте.",
  3: "Геолокация не ответила вовремя. Попробуйте ещё раз или выберите точку на карте.",
}

/**
 * "Мой район": the home point that help offer radii are measured from. It is
 * stored in the profile and visible to the owner only. Without it matching
 * falls back to the profile city and ignores the radius. The map opens in a
 * dialog, so Leaflet loads only when the user wants to change the point.
 */
export function HomeAreaCard({ user }: { user: CurrentUser }) {
  const saved = savedPoint(user)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(saved)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useTransientNotice()
  const cities = useCities()
  const update = useUpdateProfile()
  const city = cities.data
    ?.flatMap((group) => group.cities)
    .find((item) => item.code === user.cityCode)
  const dirty =
    draft?.latitude !== saved?.latitude || draft?.longitude !== saved?.longitude

  const pick = (point: HomePoint) => {
    setError("")
    setNotice("")
    setDraft({
      latitude: round(point.latitude),
      longitude: round(point.longitude),
    })
  }

  function locate() {
    if (!navigator.geolocation) {
      setError("Браузер не поддерживает геолокацию. Выберите точку на карте.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false)
        pick({ latitude: coords.latitude, longitude: coords.longitude })
      },
      (geolocationError) => {
        setLocating(false)
        setError(
          geolocationErrors[geolocationError.code] ?? geolocationErrors[2],
        )
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 300_000 },
    )
  }

  async function save() {
    setError("")
    try {
      // PUT /account/profile replaces every field, so send the rest as is.
      await update.mutateAsync({
        displayName: user.displayName,
        cityCode: user.cityCode ?? null,
        bio: user.bio ?? null,
        homeLatitude: draft?.latitude ?? null,
        homeLongitude: draft?.longitude ?? null,
      })
      setOpen(false)
      setNotice(draft ? "Точка сохранена" : "Точка удалена")
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Не удалось сохранить точку."))
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
        {saved
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
          setDraft(saved)
          setError("")
          setNotice("")
          setOpen(true)
        }}
      >
        <MapPinned aria-hidden />
        {saved ? "Изменить местоположение" : "Задать местоположение"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!update.isPending) setOpen(next)
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Мой район</DialogTitle>
            <DialogDescription>
              {draft
                ? "Нажмите на карту, чтобы перенести точку."
                : "Нажмите на карту, чтобы поставить точку."}
            </DialogDescription>
          </DialogHeader>
          <HomeAreaMap
            point={draft}
            city={
              city
                ? { latitude: city.latitude, longitude: city.longitude }
                : null
            }
            onPick={pick}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <LoadingButton
              type="button"
              variant="outline"
              className="h-11 sm:h-10"
              loading={locating}
              loadingText="Определяем…"
              disabled={update.isPending}
              onClick={locate}
            >
              <LocateFixed aria-hidden />
              Определить по геолокации
            </LoadingButton>
            <Button
              type="button"
              variant="ghost"
              className="h-11 sm:h-10"
              disabled={!draft || update.isPending}
              onClick={() => {
                setError("")
                setDraft(null)
              }}
            >
              <X aria-hidden />
              Убрать точку
            </Button>
          </div>
          <FormAlert message={error} />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={update.isPending}
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <LoadingButton
              type="button"
              loading={update.isPending}
              loadingText="Сохраняем…"
              disabled={!dirty}
              onClick={() => void save()}
            >
              {draft ? "Сохранить точку" : "Сохранить без точки"}
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}
