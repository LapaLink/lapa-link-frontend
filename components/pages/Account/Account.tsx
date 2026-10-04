"use client"
import Link from "next/link"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { RequireAuth } from "@/components/common"
import { Button } from "@/components/ui"

export function Account() {
  const { user } = useAuth()
  return (
    <RequireAuth>
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <h1 className="text-3xl font-bold">Мой профиль</h1>
        <dl className="grid grid-cols-1 gap-3 rounded-2xl border bg-card p-6 sm:grid-cols-2">
          <dt className="text-muted-foreground">Имя</dt>
          <dd className="break-words">{user?.displayName}</dd>
          <dt className="text-muted-foreground">Электронная почта</dt>
          <dd className="break-words">{user?.email}</dd>
        </dl>
        <Button variant="outline" asChild>
          <Link href={ROUTES.HOME}>На главную</Link>
        </Button>
      </section>
    </RequireAuth>
  )
}
