"use client"

import "leaflet/dist/leaflet.css"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet"
import type { Map as LeafletMap } from "leaflet"
import { ROUTES } from "@/lib/constants"
import type { MapBounds } from "@/lib/cases"
import type { CaseMapItem, NeedPriority } from "@/types"

export type MapView = { latitude: number; longitude: number; zoom: number }

// Marker fill by the priority of the case's most urgent need. Classes, not
// colors: SVG attributes don't resolve CSS variables.
const priorityClasses: Record<NeedPriority | "NONE", string> = {
  HIGH: "fill-primary",
  MEDIUM: "fill-amber-500",
  LOW: "fill-slate-500",
  NONE: "fill-slate-300",
}
// Labels stay on only when they fit: zoomed in and not too many markers.
const LABEL_ZOOM = 13
const LABEL_LIMIT = 40
const BOUNDS_DELAY_MS = 300

const round = (value: number) => Math.round(value * 1e4) / 1e4

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
 * Feed map: case markers colored by need priority with the need type as the
 * label, the search point with its radius. Client only: load it with
 * `next/dynamic` and `ssr: false`.
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
          <CircleMarker
            center={[point.latitude, point.longitude]}
            radius={6}
            pathOptions={{
              color: "white",
              weight: 2,
              fillOpacity: 1,
              className: "fill-foreground",
            }}
          />
        </>
      )}
      {items.map((item) => {
        const label = item.topNeedType
          ? needTypeName(item.topNeedType)
          : item.title
        return (
          <CircleMarker
            // A label switch remounts the marker so Leaflet re-binds the tooltip.
            key={`${item.id}-${labels}`}
            center={[item.latitude, item.longitude]}
            radius={item.topNeedPriority === "HIGH" ? 10 : 8}
            pathOptions={{
              color: "white",
              weight: 3,
              fillOpacity: 1,
              className: priorityClasses[item.topNeedPriority ?? "NONE"],
            }}
          >
            <Tooltip
              permanent={labels}
              direction="right"
              offset={[10, 0]}
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
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
