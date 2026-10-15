import type { CaseNeed } from "@/types"

const pad = (value: number) => String(value).padStart(2, "0")

/** UTC ISO instant → `YYYY-MM-DDTHH:mm` in the user's zone for a datetime-local input. */
export function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** datetime-local value in the user's zone → UTC ISO instant; empty or invalid → null. */
export function fromLocalDateTimeInput(value: string): string | null {
  if (!value) return null
  // A date-time string without an offset is parsed in the local zone.
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
})
const timeFormat = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
})
// "20 окт." → "20 окт"
const day = (date: Date) => dayFormat.format(date).replace(/\.$/, "")
const time = (date: Date) => timeFormat.format(date)
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

/**
 * Need time window in the user's zone: "до 20 окт, 18:00",
 * "20 окт 09:00–18:00", "с 20 окт, 09:00"; empty when neither bound is set.
 */
export function formatNeedWindow(
  startsAt: string | null,
  deadline: string | null,
): string {
  const start = startsAt ? new Date(startsAt) : null
  const end = deadline ? new Date(deadline) : null
  if (start && end)
    return sameDay(start, end)
      ? `${day(start)} ${time(start)}–${time(end)}`
      : `${day(start)}, ${time(start)} – ${day(end)}, ${time(end)}`
  if (end) return `до ${day(end)}, ${time(end)}`
  if (start) return `с ${day(start)}, ${time(start)}`
  return ""
}

/** The deadline has passed while the need is still open or assigned. */
export function isNeedOverdue(
  need: Pick<CaseNeed, "deadline" | "status">,
  now = Date.now(),
) {
  return (
    need.status !== "CLOSED" &&
    !!need.deadline &&
    new Date(need.deadline).getTime() <= now
  )
}
