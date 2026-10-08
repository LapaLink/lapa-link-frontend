import Link from "next/link"
import { HeartHandshake, Megaphone, PawPrint } from "lucide-react"
import { Header } from "../Header/Header"
import { Footer } from "../Footer/Footer"
import { ROUTES } from "@/lib/constants"

const benefits = [
  { icon: Megaphone, text: "Подайте объявление о найденном животном за пару минут." },
  { icon: HeartHandshake, text: "Предлагайте помощь тем, кто рядом, и следите за ответами." },
  { icon: PawPrint, text: "Все ваши объявления и добрые дела — в одном месте." },
]

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
        <section className="hidden flex-col items-start gap-6 md:flex">
          <h2 className="max-w-md text-4xl font-bold leading-tight tracking-tight">
            Ближе друг к другу.
            <br />
            Ближе к дому.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
            Помогайте кошкам и собакам рядом с вами. Даже маленькое доброе дело
            меняет чью-то жизнь.
          </p>
          <ul className="flex max-w-sm flex-col gap-4">
            {benefits.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="pt-2 text-sm leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
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
