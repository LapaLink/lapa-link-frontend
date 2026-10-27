"use client"

import Link from "next/link"
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ComponentType,
} from "react"
import { cn } from "cn"
import {
  ArrowLeft,
  Bell,
  Globe,
  HeartHandshake,
  KeyRound,
  LayoutGrid,
  Mail,
  MapPin,
  PawPrint,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react"
import {
  useAuth,
  useCities,
  useDictionaryLocale,
  useTransientNotice,
} from "@/hooks"
import { ROUTES } from "@/lib/constants"
import { getCityName } from "@/lib/dictionaries"
import type { CurrentUser } from "@/types"
import {
  RequireAuth,
  SectionCard,
  StatusBadge,
  UserAvatar,
} from "@/components/common"
import { Card, CardContent } from "@/components/ui"
import {
  AccountSkeleton,
  AvatarCard,
  AvatarEditor,
  DeleteAccountAction,
  EmailChangeCard,
  HelpOffersCard,
  HomeAreaCard,
  LanguageCard,
  LanguagePicker,
  NotificationSettings,
  NotificationsCard,
  PasswordChangeAction,
  ProfileCard,
  ProfileEditForm,
  ProfileSummaryCard,
} from "./common"
import { SettingRow } from "./common/SettingRow"

type SectionId = "overview" | "personal" | "notifications" | "help" | "security"

const sections: Array<{
  id: SectionId
  label: string
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
}> = [
  {
    id: "overview",
    label: "Обзор",
    icon: LayoutGrid,
    title: "Мой профиль",
    description: "Управляйте аккаунтом и настройками помощи животным.",
  },
  {
    id: "personal",
    label: "Личные данные",
    icon: UserRound,
    title: "Личные данные",
    description: "Имя, город, фото и контакты, которые видят другие.",
  },
  {
    id: "notifications",
    label: "Уведомления",
    icon: Bell,
    title: "Уведомления",
    description: "Где и о чём вам сообщать.",
  },
  {
    id: "help",
    label: "Моя помощь",
    icon: HeartHandshake,
    title: "Моя помощь",
    description:
      "Чем и где вы готовы помочь — по этим настройкам подбираем объявления в «Подходит мне».",
  },
  {
    id: "security",
    label: "Безопасность",
    icon: ShieldCheck,
    title: "Безопасность",
    description: "Пароль, язык аккаунта и его удаление.",
  },
]

// Anchors linked from other places open the section that holds them.
const anchorSections: Record<string, SectionId> = {
  profile: "personal",
  photo: "personal",
  "help-offers": "help",
  "home-area": "help",
}

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange)
  return () => window.removeEventListener("hashchange", onChange)
}

/** The URL hash without "#": a section id or an anchor inside a section. */
function useHash() {
  return useSyncExternalStore(
    subscribeHash,
    () => decodeURIComponent(window.location.hash.slice(1)),
    () => "",
  )
}

/**
 * Profile with a section menu (a side column on wide screens, a scrollable
 * row on phones). The section lives in the URL hash, so links such as
 * `/account#help-offers` open "Моя помощь" and scroll to that block.
 */
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
  const hash = useHash()
  const current: SectionId =
    sections.find((section) => section.id === hash)?.id ??
    anchorSections[hash] ??
    "overview"
  const section = sections.find((item) => item.id === current)!
  const content = useRef<HTMLDivElement>(null)

  // A nested anchor scrolls to its block; a section switch scrolls back up
  // only when the section top is out of view (the menu is above it on phones).
  useEffect(() => {
    const anchor = !!anchorSections[hash]
    const target = anchor ? document.getElementById(hash) : content.current
    if (target && (anchor || target.getBoundingClientRect().top < 0))
      target.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [hash])

  if (!user) return null
  const open = (id: SectionId) => {
    window.location.hash = id
  }

  return (
    <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
      <AccountMenu user={user} current={current} />
      <div
        ref={content}
        className="flex min-w-0 scroll-mt-24 flex-col gap-5 sm:gap-6"
      >
        <header className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              {section.title}
            </h1>
            <p className="text-foreground/70">{section.description}</p>
          </div>
          {current === "overview" && (
            <div className="flex items-center gap-4 rounded-2xl bg-primary-soft px-5 py-4 xl:max-w-sm">
              <span
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                <HeartHandshake className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">Спасибо, что помогаете!</p>
                <p className="text-sm text-foreground/70">
                  Вместе мы делаем мир добрее для животных.
                </p>
              </div>
              <PawPrint
                aria-hidden
                className="size-7 shrink-0 text-primary/60"
              />
            </div>
          )}
        </header>

        {current === "overview" && (
          <OverviewSection user={user} onOpen={open} />
        )}
        {current === "personal" && <PersonalSection user={user} />}
        {current === "notifications" && (
          <div className="flex flex-col gap-5 rounded-2xl border border-foreground/[0.07] bg-card p-5 shadow-card sm:p-6">
            <NotificationSettings user={user} />
          </div>
        )}
        {current === "help" && (
          <>
            <div id="home-area" className="min-w-0 scroll-mt-24">
              <HomeAreaCard user={user} />
            </div>
            <div id="help-offers" className="min-w-0 scroll-mt-24">
              <HelpOffersCard user={user} />
            </div>
          </>
        )}
        {current === "security" && <SecuritySection user={user} />}
      </div>
    </div>
  )
}

/** Side menu with the user; a horizontal row of sections on phones. */
function AccountMenu({
  user,
  current,
}: {
  user: CurrentUser
  current: SectionId
}) {
  const cities = useCities()
  const locale = useDictionaryLocale()
  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <div className="flex flex-col gap-4 rounded-2xl border border-foreground/[0.07] bg-card p-2 shadow-card lg:p-4">
        <div className="hidden items-center gap-3 px-1 lg:flex">
          <UserAvatar user={user} size="lg" />
          <div className="flex min-w-0 flex-col">
            <p className="truncate font-bold">{user.displayName}</p>
            <p className="flex items-center gap-1 text-xs text-foreground/70">
              <MapPin aria-hidden className="size-3.5 shrink-0 text-primary" />
              <span className="truncate">
                {user.cityCode
                  ? getCityName(cities.data, user.cityCode, locale)
                  : "Город не указан"}
              </span>
            </p>
          </div>
        </div>
        <nav aria-label="Разделы профиля">
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {sections.map(({ id, label, icon: Icon }) => {
              const active = id === current
              return (
                <li key={id} className="shrink-0">
                  {/* A plain anchor: next/link changes the hash with pushState,
                      which fires no hashchange, so the section would not switch. */}
                  <a
                    href={`#${id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 lg:min-h-10",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-foreground/75 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon aria-hidden className="size-4 shrink-0" />
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
        <Link
          href={ROUTES.CASES}
          className="hidden min-h-10 items-center gap-2 rounded-xl border-t border-foreground/[0.06] px-3 pt-4 text-sm font-semibold text-foreground/70 outline-none transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/40 lg:flex"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Назад к объявлениям
        </Link>
      </div>
    </aside>
  )
}

function OverviewSection({
  user,
  onOpen,
}: {
  user: CurrentUser
  onOpen: (id: SectionId) => void
}) {
  return (
    <>
      <ProfileSummaryCard user={user} onEdit={() => onOpen("personal")} />
      <div className="grid items-stretch gap-5 sm:gap-6 md:grid-cols-2">
        {/* Editing happens on "Личные данные"; here the card only reads. */}
        <ProfileCard
          user={user}
          editing={false}
          onEditingChange={(editing) => editing && onOpen("personal")}
        />
        <EmailChangeCard
          email={user.email}
          verified={
            user.emailVerifiedAt === undefined
              ? undefined
              : !!user.emailVerifiedAt
          }
        />
        <div className="md:col-span-2">
          <AvatarCard user={user} />
        </div>
      </div>
      <NotificationsCard user={user} />
      <HelpOffersCard user={user} />
      <SectionCard icon={Globe} title="Настройки аккаунта" fullWidthBody>
        <div className="divide-y divide-foreground/[0.06]">
          <AccountSettingRows user={user} />
        </div>
      </SectionCard>
    </>
  )
}

/** "Общая информация" with the photo and the form, contacts and language aside. */
function PersonalSection({ user }: { user: CurrentUser }) {
  const [notice, setNotice] = useTransientNotice()
  return (
    <div className="grid items-start gap-5 sm:gap-6 2xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card className="min-w-0 py-0">
        <CardContent className="flex flex-col gap-0 p-0">
          <h2 className="border-b border-foreground/[0.06] px-5 py-4 text-lg font-bold sm:px-6">
            Общая информация
          </h2>
          <div
            id="photo"
            className="scroll-mt-24 border-b border-foreground/[0.06] px-5 py-5 sm:px-6"
          >
            <AvatarEditor user={user} />
          </div>
          <div
            id="profile"
            className="flex scroll-mt-24 flex-col gap-4 px-5 py-5 sm:px-6"
          >
            <h3 className="text-xs font-bold tracking-wide text-foreground/60 uppercase">
              Основное
            </h3>
            <ProfileEditForm
              // A saved profile restarts the form from the new values.
              key={`${user.displayName}|${user.cityCode}|${user.bio}`}
              user={user}
              layout="page"
              onSaved={() => setNotice("Изменения сохранены")}
              onCancel={() => setNotice("")}
            />
            {notice && (
              <p role="status" className="text-sm text-success-foreground">
                {notice}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
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
      </div>
    </div>
  )
}

/** Language, password and deletion as settings lines. */
function AccountSettingRows({ user }: { user: CurrentUser }) {
  return (
    <>
      <SettingRow
        icon={Globe}
        title="Язык"
        description="На нём приходят письма, ошибки и названия городов."
      >
        <LanguagePicker user={user} />
      </SettingRow>
      <SettingRow
        icon={KeyRound}
        title="Пароль"
        description="Используется для входа в аккаунт."
      >
        <PasswordChangeAction className="sm:items-end" />
      </SettingRow>
      <SettingRow
        icon={Trash2}
        title="Опасная зона"
        description="Удаление аккаунта необратимо. Восстановить данные будет нельзя."
        tone="danger"
      >
        <DeleteAccountAction />
      </SettingRow>
    </>
  )
}

function SecuritySection({ user }: { user: CurrentUser }) {
  const verified = !!user.emailVerifiedAt
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-foreground/[0.07] bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2 rounded-2xl bg-muted/70 p-5">
        <ShieldCheck aria-hidden className="size-7 text-primary" />
        <p className="font-bold">Защитите аккаунт</p>
        <p className="max-w-xl text-sm text-foreground/75">
          Используйте уникальный пароль не короче 8 символов и никому не
          сообщайте коды из писем. Подтверждённый email нужен, чтобы
          восстановить доступ.
        </p>
      </div>
      <div className="divide-y divide-foreground/[0.06]">
        <SettingRow
          icon={Mail}
          title="Электронная почта"
          description={
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all">{user.email}</span>
              {user.emailVerifiedAt !== undefined && (
                <StatusBadge tone={verified ? "success" : "muted"}>
                  {verified ? "Подтверждён" : "Не подтверждён"}
                </StatusBadge>
              )}
            </span>
          }
        >
          <a
            href="#personal"
            className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 sm:min-h-10"
          >
            Изменить
          </a>
        </SettingRow>
        <AccountSettingRows user={user} />
      </div>
    </div>
  )
}
