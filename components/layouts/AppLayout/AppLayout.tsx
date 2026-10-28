import type { ReactNode } from "react"
import { Header } from "../Header/Header"
import { Footer } from "../Footer/Footer"
import { BottomNav } from "../BottomNav/BottomNav"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    // The bottom padding keeps the footer clear of the phone tab bar.
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Header />
      <main
        id="main-content"
        className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col px-[max(1rem,env(safe-area-inset-left))] py-6 sm:px-6 sm:py-8 lg:py-10"
      >
        {children}
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
