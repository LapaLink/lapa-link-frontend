"use client"

import "leaflet/dist/leaflet.css"
import { useEffect } from "react"
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"

export type HomePoint = { latitude: number; longitude: number }

const POINT_ZOOM = 13
const CITY_ZOOM = 11
const COUNTRY_ZOOM = 6
// Center of Belarus when neither a point nor a city is known.
const COUNTRY_CENTER: [number, number] = [53.7, 27.95]

function PickPoint({ onPick }: { onPick: (point: HomePoint) => void }) {
  useMapEvents({
    click: ({ latlng }) =>
      onPick({ latitude: latlng.lat, longitude: latlng.wrap().lng }),
  })
  return null
}

/** Pans to a point chosen outside the map, e.g. by geolocation. */
function FollowPoint({ point }: { point: HomePoint | null }) {
  const map = useMap()
  useEffect(() => {
    if (point && !map.getBounds().contains([point.latitude, point.longitude]))
      map.setView([point.latitude, point.longitude], POINT_ZOOM)
  }, [map, point])
  return null
}

/**
 * OpenStreetMap with the home point; a click picks a new one. Client only:
 * Leaflet needs `window`, so load it with `next/dynamic` and `ssr: false`.
 */
export default function HomeAreaMap({
  point,
  city,
  onPick,
}: {
  point: HomePoint | null
  /** Profile city, used as the initial view when there is no point. */
  city: HomePoint | null
  onPick: (point: HomePoint) => void
}) {
  const start = point ?? city
  return (
    // `isolate` keeps Leaflet's high z-index panes under the sticky header.
    <div className="isolate h-64 overflow-hidden rounded-2xl border sm:h-72">
      <MapContainer
        center={start ? [start.latitude, start.longitude] : COUNTRY_CENTER}
        zoom={point ? POINT_ZOOM : city ? CITY_ZOOM : COUNTRY_ZOOM}
        className="size-full cursor-crosshair"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {point && (
          <CircleMarker
            center={[point.latitude, point.longitude]}
            radius={9}
            // The class sets the fill: SVG attributes don't resolve CSS variables.
            pathOptions={{
              color: "white",
              weight: 3,
              fillOpacity: 1,
              className: "fill-primary",
            }}
          />
        )}
        <PickPoint onPick={onPick} />
        <FollowPoint point={point} />
      </MapContainer>
    </div>
  )
}
