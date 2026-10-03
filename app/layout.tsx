import type { Metadata } from "next"
import { Nunito_Sans } from "next/font/google"
import "./globals.css"
import { QueryProvider } from "@/components/providers"

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "LapaLink — добрые дела рядом", template: "%s · LapaLink" },
  description:
    "Помогаем найденным и бездомным кошкам и собакам найти заботу и дом.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${nunitoSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  )
}
