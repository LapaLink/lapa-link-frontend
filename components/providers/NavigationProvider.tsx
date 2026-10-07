"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useTransition,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import NextLink from "next/link"
import type { ComponentProps } from "react"

const NavigationContext = createContext<((href: string) => void) | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const destination = useRef<string | null>(null)
  useEffect(() => {
    if (!pending) {
      destination.current = null
      return
    }
    const timeout = setTimeout(() => {
      if (destination.current) window.location.assign(destination.current)
    }, 20_000)
    return () => clearTimeout(timeout)
  }, [pending, pathname])
  const navigate = (href: string) => {
    if (destination.current || href === pathname) return
    destination.current = href
    startTransition(() => router.push(href))
  }
  return (
    <NavigationContext.Provider value={navigate}>
      {children}
    </NavigationContext.Provider>
  )
}

export function NavigationLink(props: ComponentProps<typeof NextLink>) {
  const navigate = useContext(NavigationContext)
  return (
    <NextLink
      {...props}
      onNavigate={(event) => {
        if (navigate && typeof props.href === "string") {
          event.preventDefault()
          navigate(props.href)
        } else props.onNavigate?.(event)
      }}
    />
  )
}
