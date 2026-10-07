"use client"

import {
  ArrowRight,
  HeartHandshake,
  House,
  MapPin,
  PawPrint,
  Camera,
  MessageCircle,
  Truck,
  Package,
  Cat,
  Dog,
} from "lucide-react"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { NavigationLink as Link } from "@/components/providers"
import { FormAlert } from "@/components/common"
import { Button } from "@/components/ui"

const ways = [
  {
    icon: House,
    title: "Дать временный дом",
    text: "Приютить на несколько дней, пока найдётся семья.",
  },
  {
    icon: Truck,
    title: "Помочь с поездкой",
    text: "Отвезти к ветеринару или на передержку.",
  },
  {
    icon: Package,
    title: "Поделиться нужным",
    text: "Передать корм, тёплую подстилку или переноску.",
  },
  {
    icon: Camera,
    title: "Помочь на месте",
    text: "Сделать фото, проведать животное или помочь с уходом.",
  },
]
const steps = [
  {
    icon: MapPin,
    title: "Найдите тех, кто рядом",
    text: "Выберите город и посмотрите, какая помощь сейчас нужна.",
  },
  {
    icon: MessageCircle,
    title: "Предложите помощь",
    text: "Оставьте отклик и расскажите, что вы можете сделать.",
  },
  {
    icon: HeartHandshake,
    title: "Сделайте доброе дело",
    text: "Договоритесь с автором и помогите животному.",
  },
]

export function Home() {
  const { user, error, checkSession } = useAuth()
  return (
    <div className="flex flex-col gap-14 pb-8 sm:gap-20">
      {error && (
        <div className="flex flex-col items-start gap-3">
          <FormAlert message={error.message} />
          <Button variant="outline" onClick={() => void checkSession()}>
            Попробовать ещё раз
          </Button>
        </div>
      )}
      <section className="relative isolate grid items-center gap-8 overflow-hidden rounded-3xl bg-secondary px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.15fr_1fr] lg:px-14">
        <div className="flex min-w-0 flex-col items-start gap-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/70 px-3 py-2 text-xs font-semibold text-primary">
            <PawPrint className="size-4" aria-hidden />
            Добрые дела начинаются рядом
          </p>
          <h1 className="max-w-xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl">
            Маленькая помощь.
            <br />
            <span className="text-primary">Большая перемена.</span>
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Для кошки или собаки ваш отклик может стать началом новой жизни.
            Найдите тех, кому нужна помощь, и сделайте первый шаг вместе с
            LapaLink.
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button size="lg" asChild>
              <Link href={ROUTES.CASES}>
                Хочу помочь
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href={ROUTES.CREATE_CASE}>Я нашёл животное</Link>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Передержка, поездка, корм или просто ваше время.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="relative mx-auto hidden aspect-square w-full max-w-sm items-center justify-center lg:flex"
        >
          <div className="absolute inset-5 rounded-full border border-primary/15" />
          <div className="absolute inset-12 rounded-full bg-primary/10" />
          <div className="relative flex size-60 items-center justify-center rounded-[4rem] border border-primary/15 bg-background/80 shadow-xl shadow-primary/10 -rotate-6">
            <Cat className="size-28 text-primary" strokeWidth={1.25} />
            <Dog
              className="-ml-5 mt-12 size-28 text-primary/65"
              strokeWidth={1.25}
            />
          </div>
          <div className="absolute right-2 top-10 flex items-center gap-2 rounded-2xl bg-background px-4 py-3 shadow-sm">
            <House className="size-5 text-primary" />
            <span className="text-sm font-semibold">Дом найдётся</span>
          </div>
          <div className="absolute bottom-9 left-0 flex items-center gap-2 rounded-2xl bg-background px-4 py-3 shadow-sm">
            <HeartHandshake className="size-5 text-primary" />
            <span className="text-sm font-semibold">Вы рядом — это важно</span>
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-7" aria-labelledby="ways-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-primary">
              Каждое участие важно
            </p>
            <h2
              id="ways-heading"
              className="text-2xl font-bold tracking-tight sm:text-3xl"
            >
              Помочь можно по-разному
            </h2>
          </div>
          <Link
            href={ROUTES.CASES}
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            Найти объявление
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ways.map(({ icon: Icon, title, text }) => (
            <article
              key={title}
              className="flex items-start gap-4 rounded-2xl border bg-background p-5 sm:flex-col sm:p-6"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="size-5" aria-hidden />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-7" aria-labelledby="steps-heading">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary">
            От отклика к доброму делу
          </p>
          <h2
            id="steps-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl"
          >
            Начать проще, чем кажется
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="flex gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary/20 text-sm font-bold text-primary">
                0{index + 1}
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="flex items-center gap-2 font-bold">
                  <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="flex flex-col items-start gap-6 rounded-3xl bg-primary px-6 py-8 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:py-10">
        <div className="flex flex-col gap-3">
          <PawPrint className="size-7" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Вместе у нас больше шансов.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed opacity-85">
            За каждым объявлением — животное, которому нужна забота. Пусть
            следующая добрая история начнётся с вас.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
        >
          <Link href={user ? ROUTES.CASES : ROUTES.REGISTER}>
            {user ? "Найти, кому помочь" : "Присоединиться"}
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>
    </div>
  )
}
