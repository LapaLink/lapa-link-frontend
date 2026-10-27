// Need priority/time window/comment, help offers and USER_BLOCKED handling.
// Local time is pinned to Minsk (UTC+3, no DST) so UTC ↔ local mapping is checked for real.
process.env.TZ = "Europe/Minsk"

import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { createRequire } from "node:module"
import ts from "typescript"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { load, response, failure } from "./otp-loader.mjs"

const require = createRequire(import.meta.url)
// Objects built inside the vm context have another prototype; compare their data.
const plain = (value) => JSON.parse(JSON.stringify(value))
const tokens = { accessToken: "access", refreshToken: "refresh" }
const NOW = Date.parse("2026-10-15T09:00:00Z")
const noDetails = {
  fromArea: "",
  toArea: "",
  cargo: "",
  periodDays: "",
  conditions: "",
}
const need = {
  id: "need-1",
  caseId: "case-1",
  type: "TRANSPORT",
  status: "OPEN",
  priority: "MEDIUM",
  startsAt: "2026-10-20T06:00:00Z",
  deadline: "2026-10-20T15:00:00Z",
  comment: "Нужна переноска",
}
const offer = {
  id: "offer-1",
  type: "TRANSPORT",
  radiusKm: 15,
  availability: "Будни после 18:00",
  active: true,
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-01T10:00:00Z",
}

// Renders a component with hooks and data mocked, resolving .ts and .tsx sources.
function render(file, name, props, { data, user, needTypes = [] } = {}) {
  const modules = new Map()
  const mocks = {
    "@/hooks": {
      useDictionaryLocale: () => "ru",
      useNeedTypes: () => ({ data: needTypes, isPending: false }),
    },
    "@/api": {
      ApiError: class ApiError extends Error {},
      getErrorMessage: (error, fallback) => error?.message || fallback,
    },
    "@tanstack/react-query": {
      useQuery: () => ({
        data,
        isPending: false,
        isError: false,
        isSuccess: true,
      }),
      useQueryClient: () => ({}),
      useMutation: () => ({ isPending: false, mutate() {} }),
    },
  }
  function loadModule(full) {
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
      return loadModule(
        [base + ".ts", base + ".tsx", path.join(base, "index.ts")].find(
          fs.existsSync,
        ),
      )
    }
    vm.runInNewContext(
      `(function(module, exports, require) { ${compiled}\n})`,
      { console, URL, Intl, Date },
    )(mod, mod.exports, resolve)
    return mod.exports
  }
  const Component = loadModule(path.resolve(file))[name]
  return renderToStaticMarkup(
    React.createElement(Component, { user, ...props }),
  )
}

function loadApi(fetch) {
  const local = new Map([["lapalink.session", JSON.stringify(tokens)]])
  const session = new Map()
  const [cases, account, auth] = load(
    ["api/cases.ts", "api/account.ts", "lib/auth/session.ts"],
    { fetch, local, session },
  )
  return { ...cases, ...account, ...auth, local, session }
}

test("need dates map between UTC ISO and local datetime-local values", () => {
  const { toLocalDateTimeInput, fromLocalDateTimeInput } = load(
    "lib/needs/dates.ts",
  )
  assert.equal(toLocalDateTimeInput("2026-10-20T09:00:00Z"), "2026-10-20T12:00")
  assert.equal(toLocalDateTimeInput("2026-10-20T22:30:00Z"), "2026-10-21T01:30")
  assert.equal(toLocalDateTimeInput(null), "")
  assert.equal(toLocalDateTimeInput("garbage"), "")
  assert.equal(
    fromLocalDateTimeInput("2026-10-20T12:00"),
    "2026-10-20T09:00:00.000Z",
  )
  assert.equal(
    fromLocalDateTimeInput("2026-10-21T01:30"),
    "2026-10-20T22:30:00.000Z",
  )
  assert.equal(fromLocalDateTimeInput(""), null)
  assert.equal(fromLocalDateTimeInput("not a date"), null)
  const iso = "2026-12-31T21:15:00.000Z"
  assert.equal(fromLocalDateTimeInput(toLocalDateTimeInput(iso)), iso)
})

test("need time window is formatted in local time and flags missed deadlines", () => {
  const { formatNeedWindow, isNeedOverdue } = load("lib/needs/dates.ts")
  assert.equal(
    formatNeedWindow(null, "2026-10-20T15:00:00Z"),
    "до 20 окт, 18:00",
  )
  assert.equal(
    formatNeedWindow("2026-10-20T06:00:00Z", "2026-10-20T15:00:00Z"),
    "20 окт 09:00–18:00",
  )
  assert.equal(
    formatNeedWindow("2026-10-20T06:00:00Z", null),
    "с 20 окт, 09:00",
  )
  assert.equal(
    formatNeedWindow("2026-10-20T06:00:00Z", "2026-10-21T15:00:00Z"),
    "20 окт, 09:00 – 21 окт, 18:00",
  )
  assert.equal(formatNeedWindow(null, null), "")
  const past = { deadline: "2026-10-14T09:00:00Z", status: "OPEN" }
  assert.equal(isNeedOverdue(past, NOW), true)
  assert.equal(isNeedOverdue({ ...past, status: "ASSIGNED" }, NOW), true)
  assert.equal(isNeedOverdue({ ...past, status: "CLOSED" }, NOW), false)
  assert.equal(isNeedOverdue({ ...need }, NOW), false)
  assert.equal(isNeedOverdue({ deadline: null, status: "OPEN" }, NOW), false)
})

test("need form validates the deadline, the window order and the comment length", () => {
  const { needFormSchema } = load("components/pages/Cases/schemas.ts")
  const schema = needFormSchema(undefined, () => NOW)
  const base = {
    type: "TRANSPORT",
    priority: "MEDIUM",
    startsAt: "",
    deadline: "",
    comment: "",
    details: noDetails,
  }
  const issues = (values, target = schema) =>
    target.safeParse(values).error?.issues.map((issue) => [
      issue.path.join("."),
      issue.message,
    ]) ?? []
  assert.deepEqual(issues(base), [])
  assert.deepEqual(issues({ ...base, type: "" }), [
    ["type", "Выберите вид помощи."],
  ])
  // 12:00 local = 09:00 UTC = NOW: not in the future.
  assert.deepEqual(issues({ ...base, deadline: "2026-10-15T12:00" }), [
    ["deadline", "Срок должен быть в будущем."],
  ])
  assert.deepEqual(issues({ ...base, deadline: "2026-10-15T12:01" }), [])
  assert.deepEqual(
    issues({
      ...base,
      startsAt: "2026-10-20T18:00",
      deadline: "2026-10-20T18:00",
    }),
    [["deadline", "Срок должен быть позже времени начала."]],
  )
  assert.deepEqual(issues({ ...base, startsAt: "2026-10-01T09:00" }), [])
  assert.deepEqual(issues({ ...base, comment: "я".repeat(1000) }), [])
  assert.equal(issues({ ...base, comment: "я".repeat(1001) })[0][0], "comment")
  assert.equal(schema.parse({ ...base, comment: "   " }).comment, "")

  // Editing: saved bounds cannot be cleared, an old deadline does not block.
  const overdue = { ...need, deadline: "2026-10-14T15:00:00Z" }
  const edit = needFormSchema(overdue, () => NOW)
  const editValues = {
    ...base,
    startsAt: "2026-10-14T09:00",
    deadline: "2026-10-14T18:00",
  }
  assert.deepEqual(issues(editValues, edit), [])
  assert.deepEqual(issues({ ...editValues, startsAt: "", deadline: "" }, edit), [
    ["startsAt", "Убрать время пока нельзя, его можно только изменить."],
    ["deadline", "Убрать время пока нельзя, его можно только изменить."],
  ])
  assert.deepEqual(
    issues({ ...editValues, deadline: "2026-10-14T19:00" }, edit),
    [["deadline", "Срок должен быть в будущем."]],
  )
})

test("need form prefills local values and sends only changed fields", () => {
  const { getNeedFormValues, toCreateNeedDto, toUpdateNeedDto } = load(
    "components/pages/Cases/schemas.ts",
  )
  assert.deepEqual(plain(getNeedFormValues()), {
    type: "",
    priority: "MEDIUM",
    startsAt: "",
    deadline: "",
    comment: "",
    details: noDetails,
  })
  const values = getNeedFormValues(need)
  assert.deepEqual(plain(values), {
    type: "TRANSPORT",
    priority: "MEDIUM",
    startsAt: "2026-10-20T09:00",
    deadline: "2026-10-20T18:00",
    comment: "Нужна переноска",
    details: noDetails,
  })
  assert.deepEqual(
    plain(toCreateNeedDto({ ...values, startsAt: "", comment: "" })),
    {
      type: "TRANSPORT",
      priority: "MEDIUM",
      deadline: "2026-10-20T15:00:00.000Z",
    },
  )
  assert.deepEqual(plain(toUpdateNeedDto(values, need)), {})
  assert.deepEqual(
    plain(toUpdateNeedDto(
      {
        ...values,
        priority: "HIGH",
        deadline: "2026-10-21T18:00",
        comment: "",
      },
      need,
    )),
    { priority: "HIGH", deadline: "2026-10-21T15:00:00.000Z", comment: "" },
  )
  // A bound that was not set and stays empty is not sent.
  const open = { ...need, startsAt: null }
  assert.deepEqual(plain(toUpdateNeedDto(getNeedFormValues(open), open)), {})
})

test("need details: type-specific fields are validated, sent only for their type and whole on edit", () => {
  const { needFormSchema, getNeedFormValues, toCreateNeedDto, toUpdateNeedDto } =
    load("components/pages/Cases/schemas.ts")
  const schema = needFormSchema(undefined, () => NOW)
  const values = (type, details) => ({
    ...getNeedFormValues(),
    type,
    details: { ...noDetails, ...details },
  })
  const paths = (input) =>
    schema.safeParse(input).error?.issues.map((issue) => issue.path.join(".")) ?? []
  assert.deepEqual(paths(values("FOSTER", { periodDays: "14" })), [])
  for (const periodDays of ["0", "366", "1.5", "abc"])
    assert.deepEqual(paths(values("FOSTER", { periodDays })), ["details.periodDays"])
  assert.deepEqual(paths(values("TRANSPORT", { fromArea: "я".repeat(101) })), [
    "details.fromArea",
  ])
  assert.deepEqual(paths(values("TRANSPORT", { cargo: "я".repeat(301) })), [
    "details.cargo",
  ])
  assert.deepEqual(paths(values("FOSTER", { conditions: "я".repeat(1001) })), [
    "details.conditions",
  ])

  // Filled fields are trimmed, the number goes as a number, empty ones are dropped.
  assert.deepEqual(
    plain(toCreateNeedDto(values("FOSTER", { periodDays: " 14 ", conditions: "" }))).details,
    { periodDays: 14 },
  )
  // Fields of another type and types without details send nothing.
  assert.equal(
    "details" in toCreateNeedDto(values("TRANSPORT", { periodDays: "14" })),
    false,
  )
  assert.equal("details" in toCreateNeedDto(values("FOOD", { cargo: "корм" })), false)

  // Saved details prefill the form; a change sends the whole object.
  const transport = {
    ...need,
    details: { fromArea: "Фрунзенский", toArea: "Заводской", cargo: "кошка" },
  }
  const edit = getNeedFormValues(transport)
  assert.equal(edit.details.fromArea, "Фрунзенский")
  assert.deepEqual(plain(toUpdateNeedDto(edit, transport)), {})
  assert.deepEqual(
    plain(toUpdateNeedDto({ ...edit, details: { ...edit.details, cargo: "" } }, transport)),
    { details: { fromArea: "Фрунзенский", toArea: "Заводской" } },
  )
  const foster = { ...need, type: "FOSTER", details: { periodDays: 7 } }
  assert.equal(getNeedFormValues(foster).details.periodDays, "7")
  // Clearing every field replaces the saved details with {}.
  assert.deepEqual(
    plain(toUpdateNeedDto({ ...getNeedFormValues(foster), details: noDetails }, foster)),
    { details: {} },
  )
})

test("needs API keeps the legacy calls and sends extended create and partial update", async () => {
  const calls = []
  const api = loadApi(async (url, options) => {
    calls.push([url, options.method, JSON.parse(options.body)])
    return response(200, need)
  })
  await api.casesApi.addNeed("case-1", "TRANSPORT")
  await api.casesApi.addNeed("case-1", "TRANSPORT", {
    priority: "HIGH",
    deadline: "2026-10-20T15:00:00.000Z",
  })
  await api.casesApi.updateNeedStatus("case-1", "need-1", "CLOSED")
  await api.casesApi.updateNeed("case-1", "need-1", { comment: "" })
  assert.deepEqual(calls, [
    ["/api/v1/cases/case-1/needs", "POST", { type: "TRANSPORT" }],
    [
      "/api/v1/cases/case-1/needs",
      "POST",
      {
        type: "TRANSPORT",
        priority: "HIGH",
        deadline: "2026-10-20T15:00:00.000Z",
      },
    ],
    ["/api/v1/cases/case-1/needs/need-1", "PATCH", { status: "CLOSED" }],
    ["/api/v1/cases/case-1/needs/need-1", "PATCH", { comment: "" }],
  ])
})

test("need errors keep the code and expose VALIDATION_FAILED fields", async () => {
  const api = loadApi(async (url) =>
    url.endsWith("/needs")
      ? failure(400, "VALIDATION_FAILED", "Проверьте поля", {
          deadline: "Срок должен быть в будущем",
        })
      : failure(400, "NEED_TIME_WINDOW_INVALID", "Начало позже срока"),
  )
  await assert.rejects(api.casesApi.addNeed("case-1", "TRANSPORT"), (error) => {
    assert.equal(error.status, 400)
    assert.equal(error.code, "VALIDATION_FAILED")
    assert.equal(error.message, "Проверьте поля")
    assert.deepEqual(plain(error.fields), {
      deadline: "Срок должен быть в будущем",
    })
    return true
  })
  await assert.rejects(
    api.casesApi.updateNeed("case-1", "need-1", { startsAt: "x" }),
    { code: "NEED_TIME_WINDOW_INVALID", message: "Начало позже срока" },
  )
})

test("help offers API covers list, create, partial update and delete", async () => {
  const calls = []
  const api = loadApi(async (url, options) => {
    calls.push([
      url,
      options.method ?? "GET",
      options.headers.get("Authorization"),
      options.body ? JSON.parse(options.body) : undefined,
    ])
    if (options.method === "DELETE") return response(204)
    return response(200, options.method ? offer : [offer])
  })
  assert.deepEqual(plain(await api.accountApi.getHelpOffers()), [offer])
  await api.accountApi.createHelpOffer({ type: "TRANSPORT", radiusKm: 15 })
  await api.accountApi.updateHelpOffer("offer-1", { active: false })
  assert.equal(await api.accountApi.deleteHelpOffer("offer-1"), null)
  assert.deepEqual(calls, [
    ["/api/v1/account/help-offers", "GET", "Bearer access", undefined],
    [
      "/api/v1/account/help-offers",
      "POST",
      "Bearer access",
      { type: "TRANSPORT", radiusKm: 15 },
    ],
    [
      "/api/v1/account/help-offers/offer-1",
      "PATCH",
      "Bearer access",
      { active: false },
    ],
    ["/api/v1/account/help-offers/offer-1", "DELETE", "Bearer access", undefined],
  ])
})

test("USER_BLOCKED ends the session and leaves a notice; other 403s keep it", async () => {
  const blocked = loadApi(async () =>
    failure(403, "USER_BLOCKED", "Аккаунт заблокирован"),
  )
  await assert.rejects(blocked.accountApi.getHelpOffers(), {
    status: 403,
    code: "USER_BLOCKED",
    message: "Аккаунт заблокирован",
  })
  assert.equal(blocked.readTokens(), null)
  assert.equal(blocked.takeUserBlocked(), true)
  assert.equal(blocked.takeUserBlocked(), false)

  const denied = loadApi(async () => failure(403, "ACCESS_DENIED"))
  await assert.rejects(denied.accountApi.getHelpOffers(), { status: 403 })
  assert.deepEqual(plain(denied.readTokens()), tokens)
  assert.equal(denied.takeUserBlocked(), false)
})

test("help offer form validates the radius and sends only changed fields", () => {
  const {
    helpOfferSchema,
    getHelpOfferValues,
    toCreateHelpOfferDto,
    toUpdateHelpOfferDto,
    getAvailableHelpTypes,
  } = load("components/pages/Account/schemas.ts")
  const valid = { type: "TRANSPORT", radiusKm: 15, availability: "" }
  assert.equal(helpOfferSchema.safeParse(valid).success, true)
  for (const radiusKm of [0, 101, 2.5, Number.NaN])
    assert.equal(
      helpOfferSchema.safeParse({ ...valid, radiusKm }).error?.issues[0]
        .message,
      "Укажите радиус от 1 до 100 км.",
      String(radiusKm),
    )
  for (const radiusKm of [1, 100])
    assert.equal(helpOfferSchema.safeParse({ ...valid, radiusKm }).success, true)
  assert.equal(
    helpOfferSchema.safeParse({ ...valid, availability: "я".repeat(501) })
      .success,
    false,
  )
  assert.deepEqual(plain(toCreateHelpOfferDto(valid)), {
    type: "TRANSPORT",
    radiusKm: 15,
  })
  const values = getHelpOfferValues(offer)
  assert.deepEqual(plain(toUpdateHelpOfferDto(values, offer)), {})
  assert.deepEqual(
    plain(toUpdateHelpOfferDto({ ...values, radiusKm: 30, availability: "" }, offer)),
    { radiusKm: 30, availability: "" },
  )
  const types = [
    { code: "TRANSPORT", active: true },
    { code: "FOSTER", active: true },
    { code: "OLD", active: false },
  ]
  assert.deepEqual(
    getAvailableHelpTypes(types, [offer]).map((type) => type.code),
    ["FOSTER"],
  )
  assert.deepEqual(plain(getAvailableHelpTypes(undefined, undefined)), [])
})

test("need card shows priority as text, the time window, overdue mark and long comment toggle", () => {
  const file = "components/pages/Cases/NeedDetails.tsx"
  const badge = render(file, "NeedPriorityBadge", { priority: "HIGH" })
  assert.match(badge, /Высокий приоритет/)
  assert.match(badge, /<svg/)
  const overdue = render(file, "NeedTimeWindow", {
    need: { ...need, startsAt: null, deadline: "2026-01-10T15:00:00Z" },
  })
  assert.match(overdue, /до 10 янв, 18:00/)
  assert.match(overdue, /Срок истёк/)
  // Rendered inside the accordion trigger button: phrasing content only.
  assert.doesNotMatch(overdue, /<(p|div)[\s>]/)
  const closed = render(file, "NeedTimeWindow", {
    need: { ...need, status: "CLOSED", deadline: "2026-01-10T15:00:00Z" },
  })
  assert.doesNotMatch(closed, /Срок истёк/)
  assert.equal(
    render(file, "NeedTimeWindow", {
      need: { ...need, startsAt: null, deadline: null },
    }),
    "",
  )
  const long = render(file, "NeedComment", {
    comment: "Очень длинный комментарий. ".repeat(10),
  })
  assert.match(long, /line-clamp-3/)
  assert.match(long, /Показать полностью/)
  const short = render(file, "NeedComment", { comment: "Нужна переноска" })
  assert.doesNotMatch(short, /Показать полностью/)
})

test("help offers card lists offers, mutes disabled ones and hides add when nothing is left", () => {
  const file = "components/pages/Account/common/HelpOffersCard.tsx"
  const needTypes = [
    { code: "TRANSPORT", nameRu: "Перевозка", nameBe: "Перавозка", active: true },
    { code: "FOSTER", nameRu: "Передержка", nameBe: "Перадзяржка", active: true },
  ]
  const offers = [
    offer,
    { ...offer, id: "offer-2", type: "FOSTER", active: false, availability: null },
  ]
  const html = render(file, "HelpOffersCard", {}, {
    data: offers,
    needTypes,
    user: { id: "u", homeLatitude: null, homeLongitude: null },
  })
  assert.match(html, /Готовность помогать/)
  assert.match(html, /Перевозка/)
  assert.match(html, /до 15 км/)
  assert.match(html, /Будни после 18:00/)
  assert.match(html, /Временно выключено/)
  assert.match(html, /opacity-60/)
  assert.match(html, /Активно/)
  assert.match(html, /href="#home-area"/)
  assert.doesNotMatch(html, /Добавить вид помощи/)

  const withHome = render(file, "HelpOffersCard", {}, {
    data: offers,
    needTypes,
    user: { id: "u", homeLatitude: 53.9, homeLongitude: 27.56 },
  })
  assert.doesNotMatch(withHome, /href="#home-area"/)

  const empty = render(file, "HelpOffersCard", {}, {
    data: [],
    needTypes,
    user: { id: "u", homeLatitude: null, homeLongitude: null },
  })
  assert.match(empty, /Отметьте, чем вы готовы помогать/)
  assert.match(empty, /Добавить вид помощи/)
  assert.doesNotMatch(empty, /href="#home-area"/)
})

test("onboarding help step keeps existing offers checked and offers the rest", () => {
  const file = "components/pages/Onboarding/common/HelpOffersStep.tsx"
  const needTypes = [
    { code: "TRANSPORT", nameRu: "Перевозка", nameBe: "Перавозка", active: true },
    { code: "FOSTER", nameRu: "Передержка", nameBe: "Перадзяржка", active: true },
    { code: "OLD", nameRu: "Устаревшее", nameBe: "Састарэлае", active: false },
  ]
  const steps = { onNext() {}, onBack() {}, onSkip() {} }
  const html = render(file, "HelpOffersStep", steps, { data: [offer], needTypes })
  assert.match(html, /aria-pressed="true" disabled=""[^>]*>.*?Перевозка.*?уже добавлено/)
  assert.match(html, /aria-pressed="false"[^>]*>Передержка/)
  assert.doesNotMatch(html, /Устаревшее/)
  assert.doesNotMatch(html, /Выберите хотя бы один вид помощи/)
  assert.match(html, /Назад/)
  assert.match(html, /Пропустить/)
  assert.match(html, /Далее/)

  const empty = render(file, "HelpOffersStep", steps, { data: [], needTypes })
  assert.match(empty, /Выберите хотя бы один вид помощи/)
  assert.doesNotMatch(empty, /уже добавлено/)
})
