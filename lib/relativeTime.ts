const relative = new Intl.RelativeTimeFormat("ru", { numeric: "always" })
const date = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * «5 минут назад», «3 часа назад», «вчера», then the date. `now` is a
 * parameter for tests; a time from the future counts as «1 минуту назад».
 */
export function formatTimeAgo(iso: string, now = Date.now()) {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return ""
  const diff = Math.max(now - time, 0)
  if (diff < HOUR)
    return relative.format(-Math.max(Math.floor(diff / MINUTE), 1), "minute")
  if (diff < DAY) return relative.format(-Math.floor(diff / HOUR), "hour")
  const days = Math.floor(diff / DAY)
  return days === 1 ? "вчера" : date.format(new Date(time))
}
