import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
const owner = { id: "owner", displayName: "Автор" }
const item = {
  id: "case-1",
  animalType: "CAT",
  title: "Найден рыжий кот",
  cityCode: "minsk",
  photoUrl: null,
  status: "OPEN",
  createdAt: "2026-10-07T10:00:00Z",
  openNeedsCount: 2,
  applicationsCount: 5,
  author: owner,
  sex: "MALE",
  description: "Найден у парка",
  approximateAge: "Около двух лет",
  condition: "Нужен осмотр",
  needs: [],
}
const cities = [
  {
    region: "MINSK",
    center: { code: "minsk", nameRu: "Минск", nameBe: "Мінск" },
    cities: [
      {
        code: "minsk",
        nameRu: "Минск",
        nameBe: "Мінск",
        latitude: 53.9,
        longitude: 27.56,
      },
    ],
  },
]

function renderPage(
  file,
  name,
  {
    user = owner,
    data,
    error,
    pending = false,
    props = {},
    onFormDefaults,
    emailEnabled = true,
    channels,
    query = "",
  } = {},
) {
  const modules = new Map()
  const hooks = {
    useAuth: () => ({ user, isLoading: false, error: null }),
    useDictionaryLocale: () => "ru",
    useCities: () => ({ data: cities, isPending: false, isError: false }),
    useNeedTypes: () => ({ data: [] }),
    useCaseCloseReasons: () => ({ data: [] }),
    useDebouncedValue: (value) => value,
    useTransientNotice: () => ["", () => {}],
    useUpdateProfile: () => ({
      isPending: false,
      mutateAsync: async () => user,
    }),
    useUpdateNotification: () => ({ isPending: false, mutate() {} }),
    useNotificationChannels: () => ({ data: channels ?? [{ channel: "EMAIL", title: "На электронную почту", enabled: emailEnabled }, { channel: "IN_APP", title: "В приложении", enabled: true }], isPending: false, isError: false }),
    useUpdateNotificationChannel: () => ({ isPending: false, mutate() {} }),
    useUpdateLocale: () => ({ isPending: false }),
    useChatPermission: () => ({
      data: { enabled: false, canRequest: false, conversationId: null, conversationStatus: null },
      isPending: false,
      isError: false,
    }),
    useSetChatPermission: () => ({ isPending: false, isError: false, mutate() {} }),
    useParticipantConversations: () => ({ conversations: [], isPending: false, error: null }),
    useRequestChat: () => ({ isPending: false, mutate() {} }),
    useAcceptConversation: () => ({ isPending: false, mutate() {} }),
    useDeclineConversation: () => ({ isPending: false, mutate() {} }),
  }
  const result = {
    data,
    error,
    isPending: pending,
    isLoading: pending,
    isError: !!error,
    isFetching: false,
    refetch() {},
  }
  const mocks = {
    "react-hook-form": {
      ...require("react-hook-form"),
      useForm: (options) => {
        onFormDefaults?.(options.defaultValues)
        return require("react-hook-form").useForm(options)
      },
    },
    "@/hooks": hooks,
    "@/api": { getErrorMessage: (err, fallback) => err?.message || fallback },
    "next/navigation": {
      useRouter: () => ({ replace() {} }),
      usePathname: () => "/my-cases",
      useSearchParams: () => new URLSearchParams(query),
    },
    "next/link": {
      __esModule: true,
      default: ({ children, ...attributes }) =>
        React.createElement("a", attributes, children),
    },
    "next/image": {
      __esModule: true,
      default: (props) => {
        const attributes = { ...props }
        delete attributes.priority
        return React.createElement("img", attributes)
      },
    },
    "@tanstack/react-query": {
      useQuery: ({ queryKey }) =>
        queryKey[1] === "responses"
          ? { ...result, data: { content: [] } }
          : result,
      useQueryClient: () => ({}),
      useMutation: () => ({ isPending: false, isSuccess: false }),
    },
  }
  function load(sourcePath) {
    const full = path.resolve(sourcePath)
    if (modules.has(full)) return modules.get(full)
    const mod = { exports: {} }
    modules.set(full, mod.exports)
    const compiled = ts.transpileModule(fs.readFileSync(full, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText
    const resolve = (specifier) => {
      if (specifier in mocks) return mocks[specifier]
      if (!specifier.startsWith("@/") && !specifier.startsWith("."))
        return require(specifier)
      const base = specifier.startsWith("@/")
        ? path.resolve(specifier.slice(2))
        : path.resolve(path.dirname(full), specifier)
      const resolved = [
        base + ".ts",
        base + ".tsx",
        path.join(base, "index.ts"),
      ].find(fs.existsSync)
      return load(resolved)
    }
    vm.runInNewContext(
      `(function(module, exports, require) { ${compiled}\n})`,
      { console, URL, URLSearchParams, Intl, Date },
    )(mod, mod.exports, resolve)
    return mod.exports
  }
  const Component = load(file)[name]
  return renderToStaticMarkup(React.createElement(Component, props))
}

test("profile editor starts with actual flat API data and disables an unchanged save", () => {
  const user = {
    ...owner,
    cityCode: "minsk",
    bio: "Помогаю с перевозкой",
  }
  let defaults
  const html = renderPage(
    "components/pages/Account/common/ProfileCard.tsx",
    "ProfileEditForm",
    {
      user,
      props: { user, onSaved() {}, onCancel() {} },
      onFormDefaults: (value) => {
        defaults = value
      },
    },
  )
  assert.equal(defaults.displayName, owner.displayName)
  assert.equal(defaults.cityCode, "minsk")
  assert.equal(defaults.bio, user.bio)
  assert.ok(html.includes("Помогаю с перевозкой"))
  assert.ok(html.includes('role="combobox"'))
  assert.ok(html.includes("Минск"))
  assert.equal(html.includes('id="city-search"'), false)
  assert.match(html, /maxLength="100"/)
  assert.match(html, /maxLength="1000"/)
  assert.match(html, /<button[^>]*disabled[^>]*>Сохранить изменения<\/button>/)
})

test("profile starts in read mode and renders full bio and localized city", () => {
  const user = {
    ...owner,
    cityCode: "minsk",
    bio: "Помогаю с перевозкой\n\n" + "а".repeat(900),
  }
  const html = renderPage(
    "components/pages/Account/common/ProfileCard.tsx",
    "ProfileCard",
    { user, props: { user } },
  )
  assert.ok(html.includes(user.bio))
  assert.ok(html.includes("Минск"))
  assert.ok(html.includes("Редактировать"))
  assert.equal(html.includes("<form"), false)
  assert.ok(html.includes("[overflow-wrap:anywhere]"))
})

test("profile summary shows name, city and counters linking to their lists", () => {
  const user = { ...owner, cityCode: "minsk" }
  const html = renderPage(
    "components/pages/Account/common/ProfileSummaryCard.tsx",
    "ProfileSummaryCard",
    { user, data: { totalElements: 3 }, props: { user, onEdit() {} } },
  )
  assert.ok(html.includes("Автор"))
  assert.ok(html.includes("Минск"))
  assert.ok(html.includes(">объявления<"))
  assert.ok(html.includes('href="/my-cases"'))
  assert.ok(html.includes('href="/my-tasks#active"'))
  assert.ok(html.includes('href="/my-tasks#completed"'))
  assert.ok(html.includes('href="#photo"'))
  assert.ok(html.includes("Редактировать профиль"))
})

test("my cases route renders real card fields, details and edit navigation", () => {
  assert.ok(fs.existsSync("app/(main)/my-cases/page.tsx"))
  assert.ok(fs.existsSync("app/(main)/cases/[caseId]/edit/page.tsx"))
  const html = renderPage("components/pages/MyCases/MyCases.tsx", "MyCases", {
    data: { content: [item], totalPages: 3 },
  })
  for (const text of [
    item.title,
    "Активно",
    "Минск",
    "Ждут помощи",
    "Предложили помощь",
    "1 из 3",
  ])
    assert.ok(html.includes(text), text)
  assert.match(html, /<strong>2<\/strong>/)
  assert.match(html, /<strong>5<\/strong>/)
  assert.ok(html.includes('href="/cases/case-1"'))
  assert.ok(html.includes('href="/cases/case-1/edit"'))
  const closed = renderPage("components/pages/MyCases/MyCases.tsx", "MyCases", {
    data: { content: [{ ...item, status: "CLOSED" }], totalPages: 1 },
  })
  assert.ok(closed.includes("Закрыто"))
  assert.ok(!closed.includes('href="/cases/case-1/edit"'))
})

test("my cases handles anonymous, empty, loading and backend error states separately", () => {
  const file = "components/pages/MyCases/MyCases.tsx"
  const empty = renderPage(file, "MyCases", {
    data: { content: [], totalPages: 0 },
  })
  assert.ok(empty.includes("У вас пока нет объявлений."))
  assert.ok(empty.includes('href="/cases/create"'))
  const anonymous = renderPage(file, "MyCases", { user: null })
  assert.ok(anonymous.includes("Нужно войти"))
  assert.ok(anonymous.includes('href="/login"'))
  assert.ok(anonymous.includes('href="/register"'))
  assert.ok(!anonymous.includes("Мои объявления"))
  const loading = renderPage(file, "MyCases", { pending: true })
  assert.ok(loading.includes("Загружаем объявления"))
  const failed = renderPage(file, "MyCases", {
    error: new Error("Ошибка сервера"),
  })
  assert.ok(failed.includes("Ошибка сервера"))
  assert.ok(failed.includes("Попробовать ещё раз"))
  assert.ok(!failed.includes("У вас пока нет объявлений."))
})

test("edit form is prefilled for owner and inaccessible to other users and closed cases", () => {
  const file = "components/pages/EditCase/EditCase.tsx"
  let defaults
  const html = renderPage(file, "EditCase", {
    data: item,
    props: { caseId: item.id },
    onFormDefaults: (values) => {
      defaults = values
    },
  })
  assert.equal(defaults.title, item.title)
  assert.equal(defaults.description, item.description)
  assert.equal(defaults.approximateAge, item.approximateAge)
  assert.equal(defaults.condition, item.condition)
  assert.ok(html.includes("Сохранить изменения"))
  assert.ok(!html.includes("Уточнить место находки"))
  const stranger = renderPage(file, "EditCase", {
    user: { id: "other" },
    data: item,
    props: { caseId: item.id },
  })
  assert.ok(stranger.includes("Вы не можете редактировать чужое объявление."))
  assert.ok(!stranger.includes("<form"))
  const closed = renderPage(file, "EditCase", {
    data: { ...item, status: "CLOSED" },
    props: { caseId: item.id },
  })
  assert.ok(closed.includes("Объявление закрыто."))
  assert.ok(!closed.includes("<form"))
})

test("case details displays animal attributes and author-only edit action", () => {
  const file = "components/pages/Cases/CaseDetails.tsx"
  const html = renderPage(file, "CaseDetails", {
    data: item,
    props: { caseId: item.id },
  })
  for (const text of [
    "Самец",
    item.approximateAge,
    item.condition,
    "Минск",
    "07.10.2026",
  ])
    assert.ok(html.includes(text), text)
  assert.ok(html.includes('href="/cases/case-1/edit"'))
  const stranger = renderPage(file, "CaseDetails", {
    user: { id: "other" },
    data: item,
    props: { caseId: item.id },
  })
  assert.ok(!stranger.includes('href="/cases/case-1/edit"'))
})

test("needs are an accordion: summary with an author menu, the first one expanded", () => {
  const file = "components/pages/Cases/CaseDetails.tsx"
  const needs = [
    {
      id: "need-1",
      caseId: item.id,
      type: "FOSTER",
      status: "OPEN",
      priority: "HIGH",
      startsAt: null,
      deadline: null,
      comment: "Первая потребность",
    },
    {
      id: "need-2",
      caseId: item.id,
      type: "TRANSPORT",
      status: "CLOSED",
      priority: "LOW",
      startsAt: null,
      deadline: null,
      comment: "Вторая потребность",
    },
  ]
  const html = renderPage(file, "CaseDetails", {
    data: { ...item, needs },
    props: { caseId: item.id },
  })
  assert.equal(html.match(/data-slot="accordion-item"/g).length, 2)
  assert.match(html, /Высокий приоритет/)
  assert.match(html, /Низкий приоритет/)
  // Collapsed items keep only the summary; the first one shows its body.
  assert.ok(html.includes("Первая потребность"))
  assert.ok(!html.includes("Вторая потребность"))
  // Actions live in the ⋯ menu, only for needs that are not closed.
  assert.ok(html.includes('aria-label="Действия: FOSTER"'))
  assert.ok(!html.includes('aria-label="Действия: TRANSPORT"'))
  assert.ok(html.includes("Пока никто не предложил помощь"))
  const stranger = renderPage(file, "CaseDetails", {
    user: { id: "other" },
    data: { ...item, needs },
    props: { caseId: item.id },
  })
  assert.ok(!stranger.includes("Действия:"))
})

test("public cards link to details, use logo placeholder and paginate six items", () => {
  const html = renderPage("components/pages/Cases/CasesList.tsx", "CasesList", {
    data: { content: [item], totalPages: 2 },
  })
  assert.ok(html.includes('href="/cases/case-1"'))
  assert.ok(html.includes('href="/my-cases"'))
  assert.ok(html.includes('src="/icon.svg"'))
  assert.ok(html.includes("1 из 2"))
  assert.ok(!html.includes(">Открыть<"))
})

test("feed: old title links fill search, guests see the matching mode locked, no point disables radius", () => {
  const file = "components/pages/Cases/CasesList.tsx"
  const guest = renderPage(file, "CasesList", {
    user: null,
    query: "title=рыжий",
    data: { content: [item], totalPages: 1, totalElements: 1 },
  })
  assert.match(guest, /id="search-filter"[^>]*value="рыжий"/)
  assert.ok(guest.includes("Найдено объявлений: 1"))
  assert.match(guest, /aria-pressed="false"[^>]*disabled=""[^>]*>Подходит мне/)
  assert.ok(guest.includes("доступно только авторизованным"))
  assert.ok(!guest.includes('href="/my-cases"'))
  assert.match(guest.match(/<input[^>]*id="radius-filter"[^>]*>/)?.[0] ?? "", /disabled=""/)
  assert.ok(guest.includes("Укажите точку, чтобы искать рядом"))
  assert.ok(guest.includes("Сбросить фильтры"))

  const matching = renderPage(file, "CasesList", {
    query: "mode=matching&latitude=53.9&longitude=27.56&radiusKm=20",
    data: { content: [], totalPages: 0, totalElements: 0 },
  })
  assert.match(matching, /aria-pressed="true"[^>]*>Подходит мне/)
  assert.ok(matching.includes("Нет подходящих объявлений"))
  assert.ok(matching.includes('href="/account#help-offers"'))
  const radius = matching.match(/<input[^>]*id="radius-filter"[^>]*>/)?.[0] ?? ""
  assert.ok(radius.includes('value="20"'), radius)
  assert.ok(!radius.includes('disabled=""'), radius)
  assert.ok(matching.includes("Убрать точку"))
})

test("details tolerate incomplete cached data and preserve paragraph wrapping", () => {
  const loading = renderPage(
    "components/pages/Cases/CaseDetails.tsx",
    "CaseDetails",
    { data: { id: item.id }, props: { caseId: item.id } },
  )
  assert.ok(loading.includes("Загружаем объявление"))
  const html = renderPage(
    "components/pages/Cases/CaseDetails.tsx",
    "CaseDetails",
    {
      data: { ...item, description: "Первый абзац\n" + "о".repeat(300) },
      props: { caseId: item.id },
    },
  )
  assert.ok(html.includes("whitespace-pre-wrap"))
  assert.ok(html.includes("[overflow-wrap:anywhere]"))
  assert.ok(html.includes("Первый абзац\n"))
})

test("case details invite guests to sign in and keep closing disabled until a reason is chosen", () => {
  const file = "components/pages/Cases/CaseDetails.tsx"
  const withNeed = {
    ...item,
    needs: [{ id: "need-1", caseId: item.id, type: "FOSTER", status: "OPEN" }],
  }
  const guest = renderPage(file, "CaseDetails", {
    user: null,
    data: withNeed,
    props: { caseId: item.id },
  })
  assert.ok(guest.includes("Чем можно помочь"))
  assert.ok(guest.includes("Войдите, чтобы предложить помощь"))
  assert.ok(guest.includes('href="/login"'))
  assert.ok(!guest.includes("Закрыть объявление"))
  const author = renderPage(file, "CaseDetails", {
    data: withNeed,
    props: { caseId: item.id },
  })
  assert.match(author, /<button[^>]*disabled[^>]*>Закрыть объявление<\/button>/)
  assert.ok(
    author.indexOf("Чем можно помочь") < author.indexOf("Закрыть объявление"),
  )
})

test("my tasks shows a helpful empty state with a link to the catalog", () => {
  const html = renderPage("components/pages/MyTasks/MyTasks.tsx", "MyTasks", {
    data: { content: [] },
  })
  assert.ok(html.includes("Вы ещё никому не предлагали помощь"))
  assert.ok(html.includes('href="/cases"'))
})

test("case notifications switch is shown only to participants of an open case", () => {
  const file = "components/pages/Cases/CaseDetails.tsx"
  const render = (data, user) =>
    renderPage(file, "CaseDetails", { data, user, props: { caseId: item.id } })
  const author = render({ ...item, notificationsEnabled: true })
  assert.ok(author.includes("Получать уведомления по этому объявлению на email"))
  assert.ok(author.includes("предложит помощь или отменит"))
  assert.match(author, /role="switch"[^>]*aria-checked="true"/)
  const helper = render(
    { ...item, notificationsEnabled: false },
    { id: "helper" },
  )
  assert.ok(helper.includes("выберет вас помощником"))
  assert.match(helper, /role="switch"[^>]*aria-checked="false"/)
  for (const hidden of [
    render({ ...item, notificationsEnabled: null }, null),
    render({ ...item, notificationsEnabled: null }, { id: "stranger" }),
    render({ ...item, notificationsEnabled: true, status: "CLOSED" }),
  ])
    assert.ok(!hidden.includes("Получать уведомления"))
})

test("disabled email channel also disables the welcome email switch", () => {
  const html = renderPage("components/pages/Account/common/NotificationsCard.tsx", "NotificationsCard", {
    data: [{ eventType: "WELCOME", channel: "EMAIL", title: "Приветственное письмо", enabled: true }],
    emailEnabled: false,
    props: { user: { ...owner, emailVerifiedAt: "2026-10-11" } },
  })
  const welcomeSwitch = html.match(/<button[^>]*id="notification-WELCOME-EMAIL"[^>]*>/)?.[0]
  assert.ok(welcomeSwitch)
  assert.ok(welcomeSwitch.includes("disabled"))
  assert.ok(html.includes("В приложении"))
})

test("notification settings are built from the API list with translated titles", () => {
  const html = renderPage(
    "components/pages/Account/common/NotificationsCard.tsx",
    "NotificationsCard",
    {
      data: [
        { eventType: "WELCOME", channel: "EMAIL", title: "Приветственное письмо", enabled: true },
        { eventType: "NEW_FEATURE_DIGEST", channel: "EMAIL", title: "Новые возможности", enabled: false },
      ],
      props: { user: { ...owner, emailVerifiedAt: null } },
    },
  )
  assert.ok(html.includes("Приветственное письмо"))
  assert.ok(html.includes("Новые возможности"))
  assert.ok(html.includes("На электронную почту"))
  assert.match(html, /role="switch"[^>]*aria-checked="true"/)
  assert.match(html, /role="switch"[^>]*aria-checked="false"/)
  assert.ok(html.includes("email не подтверждён"))
  assert.ok(html.includes("настраиваются на странице объявления"))
  const verified = renderPage(
    "components/pages/Account/common/NotificationsCard.tsx",
    "NotificationsCard",
    { data: [], props: { user: { ...owner, emailVerifiedAt: "2026-01-01T00:00:00Z" } } },
  )
  assert.ok(!verified.includes("email не подтверждён"))
})

test("notification settings group channels by event and show email quiet hours", () => {
  const html = renderPage(
    "components/pages/Account/common/NotificationsCard.tsx",
    "NotificationsCard",
    {
      data: [
        { eventType: "WELCOME", channel: "EMAIL", title: "Приветственное письмо", enabled: true },
        { eventType: "HELP_OFFER_MATCHED", channel: "EMAIL", title: "Новые потребности рядом", enabled: true },
        { eventType: "HELP_OFFER_MATCHED", channel: "IN_APP", title: "Новые потребности рядом", enabled: false },
      ],
      channels: [
        { channel: "EMAIL", title: "Электронная почта", enabled: true, quietFrom: "22:00", quietTo: "08:00" },
        { channel: "IN_APP", title: "В приложении", enabled: true, quietFrom: null, quietTo: null },
      ],
      props: { user: { ...owner, emailVerifiedAt: "2026-01-01T00:00:00Z" } },
    },
  )
  assert.ok(html.includes("Каналы"))
  assert.ok(html.includes("Что присылать"))
  assert.equal(html.split("Новые потребности рядом").length - 1, 1)
  assert.ok(html.includes('id="notification-HELP_OFFER_MATCHED-EMAIL"'))
  assert.ok(html.includes('id="notification-HELP_OFFER_MATCHED-IN_APP"'))
  // Quiet hours belong to EMAIL only.
  assert.equal(html.split("Тихие часы").length - 1, 1)
  assert.ok(html.includes("22:00–08:00"))
})

test("language card marks the account locale as selected", () => {
  const html = renderPage(
    "components/pages/Account/common/LanguageCard.tsx",
    "LanguageCard",
    { props: { user: { ...owner, locale: "be" } } },
  )
  assert.match(html, /aria-checked="true"[^>]*>Беларуская</)
  assert.match(html, /aria-checked="false"[^>]*>Русский</)
})

test("case chat block shows the switch to the author and nothing to users without a response", () => {
  const file = "components/pages/Cases/CaseDetails.tsx"
  const author = renderPage(file, "CaseDetails", {
    data: item,
    props: { caseId: item.id },
  })
  assert.ok(author.includes("Разрешить чат с откликнувшимися"))
  assert.ok(author.includes('role="switch"'))
  const stranger = renderPage(file, "CaseDetails", {
    user: { id: "other", displayName: "Гость" },
    data: item,
    props: { caseId: item.id },
  })
  assert.ok(!stranger.includes("Чат с откликнувшимися"))
  assert.ok(!stranger.includes("Написать автору"))
  assert.ok(!stranger.includes("Автор пока не включил чат"))
})

test("gallery editor marks the first photo as cover and offers reorder and delete", () => {
  const photos = [
    { id: "p1", url: "/images/u/1.png", position: 0 },
    { id: "p2", url: "/images/u/2.png", position: 1 },
  ]
  const html = renderPage(
    "components/pages/EditCase/common/CaseGalleryEditor.tsx",
    "CaseGalleryEditor",
    { props: { caseId: "case-1", photos } },
  )
  assert.equal(html.split("Обложка").length - 1, 1)
  assert.ok(!html.includes("Сделать фото 1 обложкой"))
  assert.ok(html.includes("Сделать фото 2 обложкой"))
  assert.match(html, /aria-label="Сдвинуть фото 1 левее"[^>]*disabled=""|disabled=""[^>]*aria-label="Сдвинуть фото 1 левее"/)
  assert.ok(html.includes("Удалить фото 2"))
  assert.ok(html.includes("Добавить фото (2 из 10)"))

  const gallery = renderPage("components/pages/Cases/CaseGallery.tsx", "CaseGallery", {
    props: { photos, title: "Кот" },
  })
  assert.ok(gallery.includes("Кот, фото 1 из 2"))
  assert.ok(gallery.includes("1 из 2"))
  assert.ok(gallery.includes("Показать фото 2"))
})
