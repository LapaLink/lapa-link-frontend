"use client"
import { useEffect, useState } from "react"
import {
  readPendingVerification,
  updatePendingVerification,
  type PendingVerification,
} from "@/lib/auth"

export function usePendingVerification() {
  const [pending, setPending] = useState<PendingVerification | null>(null)
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPending(readPendingVerification())
      setIsReady(true)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  function update(pending: PendingVerification) {
    updatePendingVerification(pending)
    setPending(pending)
  }
  return { pending, isReady, update }
}
