"use client"

import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L, { type Map as LeafletMap } from "leaflet"
import {
  Cat,
  Dog,
  LocateFixed,
  LoaderCircle,
  MapPin,
  UserRound,
} from "lucide-react"
import { cn } from "cn"
import { ROUTES } from "@/lib/constants"
import type { FeedPoint, MapBounds } from "@/lib/cases"
import type { AnimalType, CaseMapItem, NeedPriority } from "@/types"

export type MapView = { latitude: number; longitude: number; zoom: number }

type Priority = NeedPriority | "NONE"

// Marker background by the priority of the case's most urgent need; the map
// legend uses the same colors.
const priorityClasses: Record<Priority, string> = {
  HIGH: "bg-primary",
  MEDIUM: "bg-amber-500",
  LOW: "bg-slate-500",
  NONE: "bg-slate-400",
}
// Accuracy circles wider than this say little and cover the map.
const ACCURACY_MAX_M = 2000
const LOCATE_ZOOM = 14
const BOUNDS_DELAY_MS = 300

const round = (value: number) => Math.round(value * 1e4) / 1e4

const caseIcons = new Map<string, L.DivIcon>()
// Height of the pin's tail under the round head.
const PIN_TAIL = 7

/** Cat or dog pin colored by priority; urgent ones are a bit larger. */
function caseIcon(animal: AnimalType, priority: Priority) {
  const key = `${animal}-${priority}`
  let icon = caseIcons.get(key)
  if (!icon) {
    const Icon = animal === "CAT" ? Cat : Dog
    const urgent = priority === "HIGH"
    const size = urgent ? 38 : 32
    icon = L.divIcon({
      // An empty class drops Leaflet's default white square behind the icon.
      className: "",
      html: renderToStaticMarkup(
        <span
          className="relative flex flex-col items-center drop-shadow-[0_3px_4px_rgb(23_36_59/0.3)]"
          style={{ width: size, height: size + PIN_TAIL }}
        >
          <span
            className={cn(
              "relative z-10 flex shrink-0 items-center justify-center rounded-full border-[3px] border-white text-white",
              priorityClasses[priority],
            )}
            style={{ width: size, height: size }}
          >
            <Icon className={urgent ? "size-5" : "size-4"} strokeWidth={2.25} />
          </span>
          {/* The tail: a rotated square peeking out under the head. */}
          <span
            className={cn(
              "-mt-2.5 size-3.5 rotate-45 rounded-[2px] border-r-[3px] border-b-[3px] border-white",
              priorityClasses[priority],
            )}
          />
        </span>,
      ),
      iconSize: [size, size + PIN_TAIL],
      // The tail's tip marks the case.
      iconAnchor: [size / 2, size + PIN_TAIL],
      tooltipAnchor: [size / 2, -(size + PIN_TAIL) / 2],
      popupAnchor: [0, -(size + PIN_TAIL)],
    })
    caseIcons.set(key, icon)
  }
  return icon
}

const ownPositionIcon = L.divIcon({
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  tooltipAnchor: [0, -18],
  html: renderToStaticMarkup(
    <span className="flex size-9 items-center justify-center rounded-full border-[3px] border-white bg-sky-700 text-white shadow-[0_2px_8px_rgb(23_36_59/0.4)]">
      <UserRound aria-hidden className="size-4" strokeWidth={2.5} />
    </span>,
  ),
})

const searchPointIcon = L.divIcon({
  className: "",
  html: renderToStaticMarkup(
    <MapPin
      className="size-8 fill-foreground text-white drop-shadow-[0_2px_3px_rgb(23_36_59/0.35)]"
      strokeWidth={1.5}
    />,
  ),
  iconSize: [32, 32],
  // The pin's tip marks the point.
  iconAnchor: [16, 30],
})

type OwnPosition = FeedPoint & { accuracy: number }

/**
 * The profile point takes precedence. With no saved point, locate via the browser.
 */
function LocateControl({ homePoint }: { homePoint?: FeedPoint }) {
  const map = useMap()
  const box = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<OwnPosition | null>(null)
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle")
  const point = homePoint ?? position
  const markerLabel = homePoint ? "Ваша точка" : "Вы здесь"
  const buttonLabel = point ? "К моей точке" : "Показать, где я"

  // Clicks on the button must not reach the map (no zoom on double click).
  useEffect(() => {
    if (!box.current) return
    L.DomEvent.disableClickPropagation(box.current)
    L.DomEvent.disableScrollPropagation(box.current)
  }, [])

  function centerOn({ latitude, longitude }: FeedPoint) {
    map.setView([latitude, longitude], Math.max(map.getZoom(), LOCATE_ZOOM))
  }

  function locate() {
    if (point) {
      setStatus("idle")
      centerOn(point)
      return
    }
    if (!navigator.geolocation) return setStatus("denied")
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!box.current) return
        setStatus("idle")
        setPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        })
        centerOn(coords)
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    )
  }

  return (
    <>
      <div
        ref={box}
        className="absolute right-3 bottom-8 z-[1000] flex flex-col-reverse items-end gap-2"
      >
        <button
          type="button"
          onClick={locate}
          disabled={status === "locating"}
          aria-label={buttonLabel}
          className={cn(
            "flex min-h-11 items-center gap-2 rounded-xl bg-card px-3 text-sm font-semibold shadow-md ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait",
            point ? "text-sky-800" : "text-foreground/80",
          )}
        >
          {status === "locating" ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
          ) : (
            <LocateFixed aria-hidden className="size-5" />
          )}
          {status === "locating" ? "Определяем…" : buttonLabel}
        </button>
        {status === "denied" && (
          <p
            role="status"
            className="max-w-48 rounded-lg bg-card px-2.5 py-1.5 text-xs font-medium shadow-md"
          >
            Не удалось определить местоположение. Разрешите доступ к геолокации.
          </p>
        )}
      </div>
      {point && (
        <>
          {!homePoint && position && position.accuracy <= ACCURACY_MAX_M && (
            <Circle
              center={[position.latitude, position.longitude]}
              radius={position.accuracy}
              interactive={false}
              pathOptions={{
                weight: 1,
                fillOpacity: 0.1,
                className: "fill-sky-500 stroke-sky-500",
              }}
            />
          )}
          <Marker
            position={[point.latitude, point.longitude]}
            icon={ownPositionIcon}
            zIndexOffset={1000}
            keyboard={false}
            interactive={false}
          >
            <Tooltip
              permanent
              direction="top"
              className="font-sans font-semibold"
            >
              {markerLabel}
            </Tooltip>
          </Marker>
        </>
      )}
    </>
  )
}

function readBounds(map: LeafletMap): MapBounds {
  const bounds = map.getBounds()
  return {
    minLat: round(Math.max(bounds.getSouth(), -90)),
    minLng: round(Math.max(bounds.getWest(), -180)),
    maxLat: round(Math.min(bounds.getNorth(), 90)),
    maxLng: round(Math.min(bounds.getEast(), 180)),
  }
}

/** Reports the visible area once the map settles after a move or zoom. */
function WatchBounds({ onChange }: { onChange: (bounds: MapBounds) => void }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const report = (map: LeafletMap) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onChange(readBounds(map)), BOUNDS_DELAY_MS)
  }
  const map = useMapEvents({
    moveend: () => report(map),
    zoomend: () => report(map),
  })
  useEffect(() => {
    map.attributionControl?.setPrefix(false)
    onChange(readBounds(map))
    return () => clearTimeout(timer.current)
    // The first area is reported once; later ones come from map events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])
  return null
}

/** Moves the map when the view changes outside it (city filter, a new point). */
function FollowView({ view }: { view: MapView }) {
  const map = useMap()
  const { latitude, longitude, zoom } = view
  useEffect(() => {
    map.setView([latitude, longitude], zoom)
  }, [map, latitude, longitude, zoom])
  return null
}

/**
 * Feed map: cat and dog markers colored by need priority with the need type
 * as the label, the search radius and a control to return to the user's point.
 * Client only: load it with `next/dynamic` and `ssr: false`.
 */
export default function CasesMap({
  view,
  point,
  homePoint,
  radiusKm,
  items,
  needTypeName,
  onBoundsChange,
}: {
  view: MapView
  point?: FeedPoint
  homePoint?: FeedPoint
  radiusKm?: number
  items: CaseMapItem[]
  needTypeName: (code: string) => string
  onBoundsChange: (bounds: MapBounds) => void
}) {
  const samePoint =
    point &&
    homePoint &&
    point.latitude === homePoint.latitude &&
    point.longitude === homePoint.longitude
  return (
    <MapContainer
      center={[view.latitude, view.longitude]}
      zoom={view.zoom}
      scrollWheelZoom={false}
      className="size-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FollowView view={view} />
      <LocateControl homePoint={homePoint} />
      <WatchBounds onChange={onBoundsChange} />
      {point && (
        <>
          {radiusKm && (
            <Circle
              center={[point.latitude, point.longitude]}
              radius={radiusKm * 1000}
              pathOptions={{
                weight: 1,
                fillOpacity: 0.06,
                className: "fill-primary stroke-primary",
              }}
            />
          )}
          {!samePoint && (
            <Marker
              position={[point.latitude, point.longitude]}
              icon={searchPointIcon}
              keyboard={false}
            >
              <Tooltip direction="top" offset={[0, -28]}>
                Точка поиска
              </Tooltip>
            </Marker>
          )}
        </>
      )}
      {items.map((item) => {
        const label = item.topNeedType
          ? needTypeName(item.topNeedType)
          : item.title
        return (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={caseIcon(item.animalType, item.topNeedPriority ?? "NONE")}
            // Urgent cases stay on top where markers overlap.
            zIndexOffset={item.topNeedPriority === "HIGH" ? 500 : 0}
            // Screen readers get the animal and title; hover shows the tooltip.
            eventHandlers={{
              add: (event) =>
                event.target
                  .getElement()
                  ?.setAttribute(
                    "aria-label",
                    `${item.animalType === "CAT" ? "Кошка" : "Собака"}: ${item.title}`,
                  ),
            }}
          >
            <Tooltip
              direction="right"
              offset={[4, 0]}
              className="font-semibold"
            >
              {label}
            </Tooltip>
            <Popup>
              <span className="flex min-w-44 flex-col gap-1 font-sans">
                <span className="text-sm font-bold text-foreground">
                  {item.title}
                </span>
                <span className="text-xs text-foreground/75">
                  {item.animalType === "CAT" ? "Кошка" : "Собака"}
                  {item.topNeedType && ` · ${needTypeName(item.topNeedType)}`}
                  {item.topNeedPriority === "HIGH" && " · Срочно"}
                </span>
                <Link
                  href={ROUTES.CASE_DETAILS(item.id)}
                  className="mt-1 text-sm font-semibold text-primary! hover:underline"
                >
                  Открыть объявление
                </Link>
              </span>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
