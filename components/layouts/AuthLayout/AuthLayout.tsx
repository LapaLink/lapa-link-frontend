import Link from "next/link"
import { ArrowLeft, HeartHandshake, Megaphone, PawPrint } from "lucide-react"
import { IconCircle } from "@/components/common"
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
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary outline-none transition-colors hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <ArrowLeft aria-hidden className="size-4" />
          На главную
        </Link>
      </Header>
      <main
        id="main-content"
        className="mx-auto grid w-full min-w-0 max-w-6xl flex-1 items-center gap-14 px-[max(1rem,env(safe-area-inset-left))] py-6 sm:px-6 sm:py-8 md:grid-cols-2 md:py-12"
      >
        <section className="hidden flex-col items-start gap-6 md:flex">
          <h2 className="max-w-md text-4xl font-extrabold leading-tight tracking-tight lg:text-5xl">
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
              <li
                key={text}
                className="flex items-center gap-3 rounded-2xl border bg-card p-3"
              >
                <IconCircle icon={Icon} size="sm" />
                <span className="text-sm leading-relaxed">{text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mx-auto flex w-full min-w-0 max-w-md flex-col gap-6 rounded-2xl border bg-card p-5 sm:gap-7 sm:p-8">
          <div className="flex flex-col items-start gap-3">
            <IconCircle icon={PawPrint} />
            <h1 className="text-3xl font-extrabold tracking-tight [overflow-wrap:anywhere]">
              {title}
            </h1>
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
