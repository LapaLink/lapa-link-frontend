"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, HeartHandshake, PawPrint } from "lucide-react"
import { useAuth } from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { RequireAuth } from "@/components/common"
import {
  AccountSkeleton,
  AvatarCard,
  EmailChangeCard,
  ProfileCard,
  PasswordChangeCard,
  LanguageCard,
  NotificationsCard,
  DeleteAccountCard,
  HelpOffersCard,
  HomeAreaCard,
  ProfileSummaryCard,
} from "./common"

export function Account() {
  return (
    <RequireAuth
      fallback={<AccountSkeleton />}
      guestMessage="Войдите, чтобы открыть свой профиль."
    >
      <AccountContent />
    </RequireAuth>
  )
}

function AccountContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [editingProfile, setEditingProfile] = useState(false)
  if (!user) return null
  return (
    <section className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={() =>
              window.history.length > 1
                ? router.back()
                : router.push(ROUTES.HOME)
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-primary outline-none transition-colors hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Назад
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Мой профиль
          </h1>
          <p className="text-muted-foreground">
            Здесь вы можете управлять своими данными, настройками и помощью,
            которую вы оказываете.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-primary-soft px-5 py-4 lg:max-w-md">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <HeartHandshake className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Спасибо, что помогаете!</p>
            <p className="text-sm text-muted-foreground">
              Вместе мы делаем мир добрее для животных.
            </p>
          </div>
          <PawPrint aria-hidden className="size-7 shrink-0 text-primary/60" />
        </div>
      </div>

      <div className="grid items-start gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ProfileSummaryCard
          user={user}
          onEdit={() => {
            setEditingProfile(true)
            document
              .getElementById("profile")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }}
        />
        <div id="profile" className="min-w-0 scroll-mt-24">
          <ProfileCard
            user={user}
            editing={editingProfile}
            onEditingChange={setEditingProfile}
          />
        </div>
      </div>

      <div className="grid items-start gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          <EmailChangeCard
            email={user.email}
            verified={
              user.emailVerifiedAt === undefined
                ? undefined
                : !!user.emailVerifiedAt
            }
          />
          <LanguageCard user={user} />
          <PasswordChangeCard />
        </div>
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
          {/* Anchor for the camera button on the summary card. */}
          <div id="photo" className="min-w-0 scroll-mt-24">
            <AvatarCard user={user} />
          </div>
          <NotificationsCard user={user} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 sm:gap-6 md:col-span-2 xl:col-span-1">
          {/* Anchor for the "укажите домашнюю точку" hint in HelpOffersCard. */}
          <div id="home-area" className="min-w-0 scroll-mt-24">
            <HomeAreaCard user={user} />
          </div>
          {/* Anchor for the "Подходит мне" empty feed link. */}
          <div id="help-offers" className="min-w-0 scroll-mt-24">
            <HelpOffersCard user={user} />
          </div>
          <DeleteAccountCard />
        </div>
      </div>
    </section>
  )
}
