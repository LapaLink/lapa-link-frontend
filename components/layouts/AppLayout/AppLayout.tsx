import type { ReactNode } from "react"
import { Header } from "../Header/Header"
import { Footer } from "../Footer/Footer"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8"
      >
        {children}
      </main>
      <Footer />
    </div>
  )
}
