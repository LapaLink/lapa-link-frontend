import type { ReactNode } from "react"
import { Header } from "../Header/Header"
import { Footer } from "../Footer/Footer"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main
        id="main-content"
        className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col px-[max(1rem,env(safe-area-inset-left))] py-6 sm:px-6 sm:py-8 lg:py-10"
      >
        {children}
      </main>
      <Footer />
    </div>
  )
}
