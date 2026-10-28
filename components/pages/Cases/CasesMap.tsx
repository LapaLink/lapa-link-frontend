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
import { Cat, Dog, LocateFixed, LoaderCircle, MapPin } from "lucide-react"
import { cn } from "cn"
import { ROUTES } from "@/lib/constants"
import type { MapBounds } from "@/lib/cases"
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
// Labels stay on only when they fit: zoomed in and not too many markers.
const LABEL_ZOOM = 13
const LABEL_LIMIT = 40
const BOUNDS_DELAY_MS = 300

const round = (value: number) => Math.round(value * 1e4) / 1e4

/** HTML marker: a lucide icon rendered once into Leaflet's `divIcon`. */
function htmlIcon(html: string, size: number) {
  return L.divIcon({
    // An empty class drops Leaflet's default white square behind the icon.
    className: "",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    tooltipAnchor: [size / 2, 0],
    popupAnchor: [0, -size / 2],
  })
}

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

const ownPositionIcon = htmlIcon(
  renderToStaticMarkup(
    <span className="relative flex size-5">
      <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/50" />
      <span className="relative size-5 rounded-full border-[3px] border-white bg-sky-500 shadow-[0_1px_6px_rgb(23_36_59/0.4)]" />
    </span>,
  ),
  20,
)

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

type OwnPosition = { latitude: number; longitude: number; accuracy: number }

/**
 * "Где я" button: shows the browser's position as a blue dot with its
 * accuracy and flies there. The feed filters stay as they are.
 */
function LocateControl() {
  const map = useMap()
  const box = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<OwnPosition | null>(null)
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle")

  // Clicks on the button must not reach the map (no zoom on double click).
  useEffect(() => {
    if (!box.current) return
    L.DomEvent.disableClickPropagation(box.current)
    L.DomEvent.disableScrollPropagation(box.current)
  }, [])

  function locate() {
    if (!navigator.geolocation) return setStatus("denied")
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setStatus("idle")
        setPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        })
        map.flyTo(
          [coords.latitude, coords.longitude],
          Math.max(map.getZoom(), LOCATE_ZOOM),
        )
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
          aria-label="Показать, где я"
          title="Показать, где я"
          className={cn(
            "flex size-10 items-center justify-center rounded-xl bg-card shadow-md ring-1 ring-foreground/10 outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait",
            position ? "text-sky-600" : "text-foreground/80",
          )}
        >
          {status === "locating" ? (
            <LoaderCircle aria-hidden className="size-5 animate-spin" />
          ) : (
            <LocateFixed aria-hidden className="size-5" />
          )}
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
      {position && (
        <>
          {position.accuracy <= ACCURACY_MAX_M && (
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
            position={[position.latitude, position.longitude]}
            icon={ownPositionIcon}
            zIndexOffset={1000}
            keyboard={false}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              Вы здесь
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
function WatchBounds({
  onChange,
}: {
  onChange: (bounds: MapBounds, zoom: number) => void
}) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const report = (map: LeafletMap) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(
      () => onChange(readBounds(map), map.getZoom()),
      BOUNDS_DELAY_MS,
    )
  }
  const map = useMapEvents({
    moveend: () => report(map),
    zoomend: () => report(map),
  })
  useEffect(() => {
    onChange(readBounds(map), map.getZoom())
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
 * as the label, the search point with its radius and the "Где я" button.
 * Client only: load it with `next/dynamic` and `ssr: false`.
 */
export default function CasesMap({
  view,
  point,
  radiusKm,
  items,
  needTypeName,
  onBoundsChange,
}: {
  view: MapView
  point?: { latitude: number; longitude: number }
  radiusKm?: number
  items: CaseMapItem[]
  needTypeName: (code: string) => string
  onBoundsChange: (bounds: MapBounds, zoom: number) => void
}) {
  const [zoom, setZoom] = useState(view.zoom)
  const labels = zoom >= LABEL_ZOOM && items.length <= LABEL_LIMIT
  return (
    <MapContainer
      center={[view.latitude, view.longitude]}
      zoom={view.zoom}
      className="size-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FollowView view={view} />
      <LocateControl />
      <WatchBounds
        onChange={(bounds, value) => {
          setZoom(value)
          onBoundsChange(bounds, value)
        }}
      />
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
          <Marker
            position={[point.latitude, point.longitude]}
            icon={searchPointIcon}
            keyboard={false}
          >
            <Tooltip direction="top" offset={[0, -28]}>
              Точка поиска
            </Tooltip>
          </Marker>
        </>
      )}
      {items.map((item) => {
        const label = item.topNeedType
          ? needTypeName(item.topNeedType)
          : item.title
        return (
          <Marker
            // A label switch remounts the marker so Leaflet re-binds the tooltip.
            key={`${item.id}-${labels}`}
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
              permanent={labels}
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
