import type { ReactNode } from "react"
import { Header } from "../Header/Header"
import { Footer } from "../Footer/Footer"
import { Sidebar } from "../Sidebar/Sidebar"
import { BottomNav } from "../BottomNav/BottomNav"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    // The bottom padding keeps the footer clear of the phone tab bar.
    <div className="flex min-h-screen flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <Header />
      <div className="mx-auto flex w-full max-w-[100rem] flex-1 lg:gap-2 lg:px-4">
        <Sidebar />
        <main
          id="main-content"
          className="mx-auto flex w-full min-w-0 flex-1 flex-col px-[max(1rem,env(safe-area-inset-left))] py-6 sm:px-6 sm:py-8 lg:px-4 lg:py-10"
        >
          {children}
        </main>
      </div>
      <Footer />
      <BottomNav />
    </div>
  )
}
