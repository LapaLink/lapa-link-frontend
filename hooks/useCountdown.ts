"use client"
import { useEffect, useState } from "react"

export function useCountdown(deadline: number) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    const initial = setTimeout(() => setNow(Date.now()), 0)
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearTimeout(initial)
      clearInterval(interval)
    }
  }, [deadline])
  return now ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0
}

export function useCooldown() {
  const [deadline, setDeadline] = useState(0)
  const secondsLeft = useCountdown(deadline)
  function start(seconds: number) {
    setDeadline(Date.now() + seconds * 1000)
  }
  return { secondsLeft, start }
}
