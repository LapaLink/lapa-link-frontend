"use client"
import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { FormAlert } from "@/components/common"
import { Button } from "@/components/ui"

export function Home() {
  const { user, error, checkSession } = useAuth()
  return (
    <div className="flex flex-1 flex-col gap-8">
      {error && (
        <div className="flex flex-col items-start gap-3">
          <FormAlert message={error.message} />
          <Button variant="outline" onClick={() => void checkSession()}>
            Попробовать ещё раз
          </Button>
        </div>
      )}
      <section className="grid flex-1 items-center gap-10 py-10 md:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Добрые дела рядом
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            У каждой лапы
            <br />
            должен быть дом.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
            Помогайте найденным и бездомным кошкам и собакам. Найти друг друга и
            сделать первый шаг проще вместе.
          </p>
          <Button size="lg" asChild>
            <Link href={user ? ROUTES.ACCOUNT : ROUTES.REGISTER}>
              {user ? "Перейти в профиль" : "Присоединиться"}
            </Link>
          </Button>
        </div>
        <Image
          src="/lapalink-logo.png"
          alt="LapaLink — мост дружбы питомцев"
          width={1254}
          height={1254}
          priority
          className="mx-auto hidden w-full max-w-sm md:block"
        />
      </section>
    </div>
  )
}
