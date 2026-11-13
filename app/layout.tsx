import type { Metadata, Viewport } from "next"
import { Onest } from "next/font/google"
import "./globals.css"
import {
  QueryProvider,
  NavigationProvider,
  NotificationsProvider,
} from "@/components/providers"
import { Toaster } from "@/components/ui"

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "LapaLink — добрые дела рядом", template: "%s · LapaLink" },
  description:
    "Помогаем найденным и бездомным кошкам и собакам найти заботу и дом.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${onest.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <NavigationProvider>
            <NotificationsProvider>
              {children}
              <Toaster position="top-right" closeButton />
            </NotificationsProvider>
          </NavigationProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
