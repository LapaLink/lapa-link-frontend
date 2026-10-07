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
      { console, URL, Intl, Date },
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
    "Открытых потребностей",
    "Откликов",
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
  assert.equal(anonymous, "")
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
