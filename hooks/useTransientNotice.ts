"use client"

import { useEffect, useState } from "react"

export function useTransientNotice() {
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(""), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return [notice, setNotice] as const
}
