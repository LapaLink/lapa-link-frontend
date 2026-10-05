"use client"
import { useAuth } from "@/hooks"
import {
  RequireAuth,
  AccountSkeleton,
  AvatarCard,
  EmailChangeCard,
} from "./common"

export function Account() {
  const { user } = useAuth()
  return (
    <RequireAuth fallback={<AccountSkeleton />}>
      {user && (
        <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 sm:gap-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Мой профиль</h1>
            <p className="break-words text-muted-foreground">
              {user.displayName}, здесь можно обновить фото и почту.
            </p>
          </div>
          <div className="grid items-start gap-6 md:grid-cols-2">
            <AvatarCard user={user} />
            <EmailChangeCard email={user.email} />
          </div>
        </section>
      )}
    </RequireAuth>
  )
}
