"use client"

import { useState } from "react"
import { getErrorMessage } from "@/api"
import { useUpdateProfile } from "@/hooks"
import type { CurrentUser } from "@/types"
import type { HomePoint } from "../common/HomeAreaMap"

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
 * Draft of the profile home point: picked on the map or by geolocation, then
 * saved with the rest of the profile (PUT /account/profile replaces every field).
 */
export function useHomePoint(user: CurrentUser) {
  const saved = savedPoint(user)
  const [draft, setDraft] = useState(saved)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState("")
  const update = useUpdateProfile()

  const pick = (point: HomePoint) => {
    setError("")
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

  /** Resolves to false on failure; the message is in `error`. */
  async function save() {
    setError("")
    try {
      await update.mutateAsync({
        displayName: user.displayName,
        cityCode: user.cityCode ?? null,
        bio: user.bio ?? null,
        homeLatitude: draft?.latitude ?? null,
        homeLongitude: draft?.longitude ?? null,
      })
      return true
    } catch (saveError) {
      setError(getErrorMessage(saveError, "Не удалось сохранить точку."))
      return false
    }
  }

  return {
    saved,
    draft,
    dirty:
      draft?.latitude !== saved?.latitude ||
      draft?.longitude !== saved?.longitude,
    pick,
    clear: () => {
      setError("")
      setDraft(null)
    },
    /** Drops unsaved changes. */
    reset: () => {
      setError("")
      setDraft(saved)
    },
    locate,
    locating,
    error,
    save,
    saving: update.isPending,
  }
}

export type HomePointState = ReturnType<typeof useHomePoint>
