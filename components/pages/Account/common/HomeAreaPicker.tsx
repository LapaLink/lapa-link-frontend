"use client"

import dynamic from "next/dynamic"
import { LocateFixed, X } from "lucide-react"
import { useCities } from "@/hooks"
import type { CurrentUser } from "@/types"
import { FormAlert, LoadingButton } from "@/components/common"
import { Button, Skeleton } from "@/components/ui"
import type { HomePointState } from "../hooks/useHomePoint"

const HomeAreaMap = dynamic(() => import("./HomeAreaMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-2xl sm:h-72" />,
})

/** Map, geolocation and "remove" for a home point draft from `useHomePoint`. */
export function HomeAreaPicker({
  user,
  home,
}: {
  user: CurrentUser
  home: HomePointState
}) {
  const cities = useCities()
  const city = cities.data
    ?.flatMap((group) => group.cities)
    .find((item) => item.code === user.cityCode)
  return (
    <>
      <HomeAreaMap
        point={home.draft}
        city={
          city ? { latitude: city.latitude, longitude: city.longitude } : null
        }
        onPick={home.pick}
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <LoadingButton
          type="button"
          variant="outline"
          className="h-11 sm:h-10"
          loading={home.locating}
          loadingText="Определяем…"
          disabled={home.saving}
          onClick={home.locate}
        >
          <LocateFixed aria-hidden />
          Определить по геолокации
        </LoadingButton>
        <Button
          type="button"
          variant="ghost"
          className="h-11 sm:h-10"
          disabled={!home.draft || home.saving}
          onClick={home.clear}
        >
          <X aria-hidden />
          Убрать точку
        </Button>
      </div>
      <FormAlert message={home.error} />
    </>
  )
}
