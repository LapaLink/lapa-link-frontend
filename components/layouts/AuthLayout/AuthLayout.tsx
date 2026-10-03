import Image from "next/image"
import Link from "next/link"
import { Header } from "../Header/Header"
import { Footer } from "../Footer/Footer"
import { ROUTES } from "@/lib/constants"

type AuthLayoutProps = {
  title: string
  description: string
  children: React.ReactNode
}

export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header>
        <Link
          href={ROUTES.HOME}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          На главную
        </Link>
      </Header>
      <main
        id="main-content"
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-14 px-6 py-8 md:grid-cols-2 md:py-12"
      >
        <section className="hidden flex-col items-start gap-5 md:flex">
          <Image
            src="/lapalink-logo.png"
            alt="Кошка и собака на мосту — логотип LapaLink"
            width={1254}
            height={1254}
            className="w-64"
            priority
          />
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Ближе друг к другу.
            <br />
            Ближе к дому.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
            Помогайте кошкам и собакам рядом с вами. Даже маленькое доброе дело
            меняет чью-то жизнь.
          </p>
        </section>
        <section className="mx-auto flex w-full max-w-md flex-col gap-7 rounded-3xl border bg-card p-6 shadow-sm sm:p-9">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          {children}
        </section>
      </main>
      <Footer />
    </div>
  )
}
