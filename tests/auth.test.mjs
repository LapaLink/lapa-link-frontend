import { test } from "node:test"
import assert from "node:assert/strict"
import vm from "node:vm"
import fs from "node:fs"
import ts from "typescript"
import path from "node:path"
import { createRequire } from "node:module"

const nodeRequire = createRequire(import.meta.url)

function load(file, fetch, sharedStorage, locks, overrides = {}) {
  const storage = sharedStorage || new Map()
  const context = {
    AbortSignal: overrides.AbortSignal ?? AbortSignal,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    Headers,
    Response,
    Event,
    TextEncoder,
    FormData,
    File,
    Blob,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    window: overrides.window ?? { dispatchEvent() {} },
    navigator: { locks },
    fetch,
  }
  const modules = new Map()
  function loadModule(file) {
    const resolved = path.resolve(file)
    if (modules.has(resolved)) return modules.get(resolved)
    const exports = {}
    modules.set(resolved, exports)
    const compiled = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      fileName: resolved,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    const requireModule = (specifier) => {
      if (specifier in overrides) return overrides[specifier]
      if (!specifier.startsWith("@/") && !specifier.startsWith("."))
        return nodeRequire(specifier)
      const base = specifier.startsWith("@/")
        ? path.resolve(specifier.slice(2))
        : path.resolve(path.dirname(resolved), specifier)
      return loadModule(
        fs.existsSync(`${base}.ts`)
          ? `${base}.ts`
          : path.join(base, "index.ts"),
      )
    }
    vm.runInNewContext(
      `(function(exports, require) { ${compiled}\n})`,
      context,
    )(exports, requireModule)
    return exports
  }
  const result = loadModule(file)
  return file === "api/instance.ts"
    ? { ...result, ...loadModule("lib/auth/session.ts") }
    : result
}
const response = (status, body) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json" },
  })
const old = { accessToken: "old-access", refreshToken: "old-refresh" }
const next = { accessToken: "new-access", refreshToken: "new-refresh" }

test("debounce cancels intermediate input and publishes only the settled search", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  let cleanup
  const updates = []
  const { useDebouncedValue } = load(
    "hooks/useDebouncedValue.ts",
    undefined,
    undefined,
    undefined,
    {
      react: {
        useState: (initial) => [initial, (value) => updates.push(value)],
        useEffect: (effect) => {
          cleanup?.()
          cleanup = effect()
        },
      },
    },
  )
  useDebouncedValue("к", 350)
  t.mock.timers.tick(200)
  useDebouncedValue("кот", 350)
  t.mock.timers.tick(349)
  assert.equal(updates.length, 0)
  t.mock.timers.tick(1)
  assert.deepEqual(updates, ["кот"])
  cleanup()
})

test("creating a case never seeds details cache with a partial POST response", async () => {
  const { QueryClient } = nodeRequire("@tanstack/react-query")
  const client = new QueryClient()
  let mutation
  const storage = new Map([["lapalink.session", JSON.stringify(old)]])
  const fetch = async (_url, options) =>
    response(
      200,
      options?.method === "POST"
        ? { id: "new-case", authorId: "owner", title: "Кот", animalType: "CAT" }
        : { id: "new-case", author: { id: "owner" }, needs: [] },
    )
  const { useCreateCase } = load(
    "components/pages/CreateCase/hooks/useCreateCase.ts",
    fetch,
    storage,
    undefined,
    {
      react: {
        useRef: (value) => ({ current: value }),
        useState: (value) => [value, () => {}],
      },
      "react-hook-form": { useForm: () => ({ reset() {}, formState: {} }) },
      "@/hooks": { dictionaryQueries: {} },
      "@tanstack/react-query": {
        useQueryClient: () => client,
        useMutation: (options) => {
          mutation = options
          return {}
        },
      },
    },
  )
  useCreateCase()
  await mutation.mutationFn({
    animalType: "CAT",
    title: "Кот",
    cityCode: "minsk",
    latitude: "53.9",
    longitude: "27.56",
    needTypes: [],
  })
  assert.equal(client.getQueryData(["cases", "detail", "new-case"]), undefined)
  const { casesApi } = load("api/cases.ts", fetch, storage)
  const details = await client.fetchQuery({
    queryKey: ["cases", "detail", "new-case"],
    queryFn: () => casesApi.getById("new-case"),
  })
  assert.equal(details.author.id, "owner")
  assert.ok(Array.isArray(details.needs))
  client.clear()
})

test("my cases uses the authenticated paginated account endpoint", async () => {
  const received = []
  const { accountApi } = load(
    "api/account.ts",
    async (url, options) => {
      received.push({ url, options })
      return response(200, { content: [], totalPages: 0 })
    },
    new Map([["lapalink.session", JSON.stringify(old)]]),
  )
  await accountApi.getCases(2, 20)
  assert.equal(received[0].url, "/api/v1/account/cases?page=2&size=20")
  assert.equal(
    received[0].options.headers.get("Authorization"),
    "Bearer old-access",
  )
  let calls = 0
  const anonymous = load("api/account.ts", () => {
    calls++
    return response(200, {})
  })
  await assert.rejects(anonymous.accountApi.getCases(), { status: 401 })
  assert.equal(calls, 0)
})

test("editing hydrates current values, enforces limits and sends only editable changes", async () => {
  const { editCaseSchema, getEditCaseValues, toUpdateCaseDto, canEditCase } =
    load("components/pages/EditCase/schemas.ts")
  const item = {
    id: "case-1",
    title: "Найдена кошка",
    description: null,
    sex: "UNKNOWN",
    approximateAge: null,
    condition: "Нужен осмотр",
    cityCode: "minsk",
    author: { id: "owner" },
    status: "OPEN",
  }
  const values = getEditCaseValues(item)
  assert.equal(values.description, "")
  assert.equal(values.condition, item.condition)
  assert.equal(canEditCase(item, "owner"), true)
  assert.equal(canEditCase(item, "other"), false)
  assert.equal(canEditCase(item), false)
  assert.equal(canEditCase({ ...item, status: "CLOSED" }, "owner"), false)
  for (const patch of [
    { title: " " },
    { title: "x".repeat(151) },
    { description: "x".repeat(2001) },
    { approximateAge: "x".repeat(51) },
    { condition: "x".repeat(501) },
    { cityCode: "" },
    { sex: "OTHER" },
  ]) {
    assert.equal(
      editCaseSchema.safeParse({ ...values, ...patch }).success,
      false,
    )
  }
  const updated = editCaseSchema.parse({
    ...values,
    title: " Новое название ",
    condition: "",
    id: "injected",
    status: "CLOSED",
  })
  const dto = toUpdateCaseDto(updated, item)
  assert.equal(
    JSON.stringify(dto),
    JSON.stringify({ title: "Новое название", condition: "" }),
  )
  assert.equal(JSON.stringify(toUpdateCaseDto(values, item)), "{}")
  const received = []
  const { casesApi } = load(
    "api/cases.ts",
    async (url, options) => {
      received.push({ url, options })
      return response(200, { ...item, ...dto })
    },
    new Map([["lapalink.session", JSON.stringify(old)]]),
  )
  await casesApi.update(item.id, dto)
  assert.equal(received[0].url, "/api/v1/cases/case-1")
  assert.equal(received[0].options.method, "PATCH")
  assert.equal(
    received[0].options.headers.get("Authorization"),
    "Bearer old-access",
  )
  assert.deepEqual(JSON.parse(received[0].options.body), {
    title: "Новое название",
    condition: "",
  })
})

test("editing invalidates detail, own pages and the public list; backend messages take priority", async () => {
  const { QueryClient } = nodeRequire("@tanstack/react-query")
  const { queryKeys, invalidateCaseData } = load("lib/queryKeys.ts")
  const client = new QueryClient()
  const keys = [
    queryKeys.caseDetail("case-1"),
    queryKeys.myCases(0),
    queryKeys.myCases(1),
    [...queryKeys.casesList, { cityCode: "minsk" }],
  ]
  keys.forEach((key) => client.setQueryData(key, { value: 1 }))
  await invalidateCaseData(client, "case-1")
  keys.forEach((key) =>
    assert.equal(client.getQueryState(key).isInvalidated, true),
  )
  client.clear()
  const { ApiError, getErrorMessage } = load("api/instance.ts")
  assert.equal(
    getErrorMessage(
      new ApiError("Сообщение бэка", 403, "NOT_CASE_AUTHOR"),
      "Ошибка",
    ),
    "Сообщение бэка",
  )
})

test("validation enforces UTF-8 byte limit and registration fields", () => {
  const { registerSchema } = load("components/pages/Auth/schemas.ts")
  assert.equal(
    registerSchema.safeParse({
      email: "user@example.com",
      password: "я".repeat(36),
      displayName: "Иван",
    }).success,
    true,
  )
  assert.equal(
    registerSchema.safeParse({
      email: "user@example.com",
      password: "я".repeat(37),
      displayName: "Иван",
    }).success,
    false,
  )
  assert.equal(
    registerSchema.safeParse({ email: "bad", password: "", displayName: " " })
      .success,
    false,
  )
})
test("anonymous protected request does not call backend", async () => {
  let calls = 0
  const api = load("api/instance.ts", () => {
    calls++
  })
  await assert.rejects(api.authorizedRequest("/account/me"), { status: 401 })
  assert.equal(calls, 0)
})

test("Zod trims identity fields and keeps login and registration requirements separate", () => {
  const { registerSchema, loginSchema, verificationSchema } = load(
    "components/pages/Auth/schemas.ts",
  )
  const parsed = registerSchema.parse({
    email: " user@example.com ",
    displayName: " Анна ",
    password: "GoodPass123",
  })
  assert.equal(parsed.email, "user@example.com")
  assert.equal(parsed.displayName, "Анна")
  assert.equal(
    loginSchema.safeParse({ email: "user@example.com", password: "old" })
      .success,
    true,
  )
  assert.equal(
    registerSchema.safeParse({
      email: "user@example.com",
      displayName: "Анна",
      password: "old",
    }).success,
    false,
  )
  for (const code of ["12345", "abcdef", "123456\n"])
    assert.equal(verificationSchema.safeParse({ code }).success, false)
  assert.equal(verificationSchema.safeParse({ code: "012345" }).success, true)
  const invalidPassword = registerSchema.safeParse({
    email: "user@example.com",
    displayName: "Анна",
    password: "я".repeat(37),
  })
  assert.ok(
    invalidPassword.error.issues.every(
      (issue) => !/utf|байт/i.test(issue.message),
    ),
  )
})
test("parallel expired requests share one refresh and rotate both tokens", async () => {
  let refreshes = 0
  const api = load("api/instance.ts", async (url, options) => {
    if (url.endsWith("/refresh")) {
      refreshes++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return response(200, next)
    }
    return options.headers.get("Authorization") === "Bearer old-access"
      ? response(401, { details: { error: "TOKEN_EXPIRED" } })
      : response(200, { id: "user" })
  })
  api.saveTokens(old)
  await Promise.all([
    api.authorizedRequest("/account/me"),
    api.authorizedRequest("/account/me"),
  ])
  assert.equal(refreshes, 1)
  assert.equal(api.readTokens().refreshToken, next.refreshToken)
})
test("cross-tab refresh is serialized with Web Locks", async () => {
  const storage = new Map()
  let queue = Promise.resolve(),
    refreshes = 0
  const locks = {
    request: (_name, callback) => {
      const task = queue.then(callback)
      queue = task.catch(() => {})
      return task
    },
  }
  const fetch = async (url, options) => {
    if (url.endsWith("/refresh")) {
      refreshes++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return response(200, next)
    }
    return options.headers.get("Authorization") === "Bearer old-access"
      ? response(401, { details: { error: "TOKEN_EXPIRED" } })
      : response(200, {})
  }
  const a = load("api/instance.ts", fetch, storage, locks),
    b = load("api/instance.ts", fetch, storage, locks)
  a.saveTokens(old)
  await Promise.all([
    a.authorizedRequest("/account/me"),
    b.authorizedRequest("/account/me"),
  ])
  assert.equal(refreshes, 1)
})
for (const code of ["SESSION_NOT_FOUND", "TOKEN_INVALID", undefined])
  test(`401 ${code || "empty body"} clears session without refresh`, async () => {
    let calls = 0
    const api = load("api/instance.ts", async () => {
      calls++
      return response(401, code ? { details: { error: code } } : null)
    })
    api.saveTokens(old)
    await assert.rejects(api.authorizedRequest("/account/me"), { status: 401 })
    assert.equal(api.readTokens(), null)
    assert.equal(calls, 1)
  })
test("revoked refresh clears tokens", async () => {
  const api = load("api/instance.ts", async (url) =>
    response(401, {
      details: {
        error: url.endsWith("/refresh")
          ? "REFRESH_TOKEN_REVOKED"
          : "TOKEN_EXPIRED",
      },
    }),
  )
  api.saveTokens(old)
  await assert.rejects(api.authorizedRequest("/account/me"), {
    code: "REFRESH_TOKEN_REVOKED",
  })
  assert.equal(api.readTokens(), null)
})
test("field validation errors and retry delay preserve backend contract", async () => {
  const api = load("api/instance.ts", async () =>
    response(400, { details: { email: "Неверный email" } }),
  )
  await assert.rejects(
    api.post("/auth/login", {}),
    (error) => error.fields.email === "Неверный email",
  )
  const limited = load("api/instance.ts", async () =>
    response(429, {
      message: "Подождите",
      details: { error: "RATE_LIMITED", retryAfterSeconds: 15 },
    }),
  )
  await assert.rejects(limited.post("/auth/login", {}), {
    retryAfterSeconds: 15,
    message: "Подождите",
  })
})
test("logout during refresh never restores the session", async () => {
  let api
  api = load("api/instance.ts", async (url) => {
    if (url.endsWith("/refresh")) {
      api.saveTokens(null)
      return response(200, next)
    }
    return response(401, { details: { error: "TOKEN_EXPIRED" } })
  })
  api.saveTokens(old)
  await assert.rejects(api.authorizedRequest("/account/me"))
  assert.equal(api.readTokens(), null)
})

for (const code of ["OTP_INVALID", "OTP_EXPIRED"])
  for (const expiredToken of [false, true])
    test(`${code} keeps session${expiredToken ? " after token refresh" : ""}`, async () => {
      let refreshes = 0
      const api = load("api/instance.ts", async (url, options) => {
        if (url.endsWith("/auth/refresh")) {
          refreshes++
          return response(200, next)
        }
        if (
          expiredToken &&
          options.headers.get("Authorization") === "Bearer old-access"
        )
          return response(401, { details: { error: "TOKEN_EXPIRED" } })
        return response(401, {
          message: "Код не подошёл",
          details: { error: code },
        })
      })
      api.saveTokens(old)
      await assert.rejects(api.authorizedRequest("/account/email/confirm"), {
        code,
      })
      assert.equal(
        api.readTokens().accessToken,
        expiredToken ? next.accessToken : old.accessToken,
      )
      assert.equal(refreshes, expiredToken ? 1 : 0)
    })

test("multipart avatar upload leaves boundary header to fetch and survives refresh", async () => {
  const file = new File(["image"], "avatar.png", { type: "image/png" })
  const body = new FormData()
  body.append("file", file)
  let uploads = 0
  const api = load("api/instance.ts", async (url, options) => {
    if (url.endsWith("/auth/refresh")) return response(200, next)
    uploads++
    assert.equal(options.headers.has("Content-Type"), false)
    assert.equal(options.body.get("file").name, "avatar.png")
    assert.equal(options.method, "PUT")
    return options.headers.get("Authorization") === "Bearer old-access"
      ? response(401, { details: { error: "TOKEN_EXPIRED" } })
      : response(200, { avatarUrl: "/avatar.png" })
  })
  api.saveTokens(old)
  const profile = await api.authorizedRequest("/account/avatar", {
    method: "PUT",
    body,
  })
  assert.equal(profile.avatarUrl, "/avatar.png")
  assert.equal(uploads, 2)
})

test("avatar validation rejects empty, oversized and unsupported files", () => {
  const { avatarSchema, emailChangeSchema } = load(
    "components/pages/Account/schemas.ts",
  )
  for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp"])
    assert.equal(
      avatarSchema.safeParse(new File(["photo"], "photo", { type })).success,
      true,
    )
  assert.equal(
    avatarSchema.safeParse(new File([], "empty.png", { type: "image/png" }))
      .success,
    false,
  )
  assert.equal(
    avatarSchema.safeParse(
      new File(["photo"], "photo.svg", { type: "image/svg+xml" }),
    ).success,
    false,
  )
  assert.equal(
    avatarSchema.safeParse(
      new File([new Uint8Array(5 * 1024 * 1024)], "max.png", {
        type: "image/png",
      }),
    ).success,
    true,
  )
  assert.equal(
    avatarSchema.safeParse(
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    ).success,
    false,
  )
  assert.equal(
    emailChangeSchema.parse({ newEmail: " new@example.com ", password: "old" })
      .newEmail,
    "new@example.com",
  )
  assert.equal(
    emailChangeSchema.safeParse({ newEmail: "invalid", password: "" }).success,
    false,
  )
})

test("logout accepts 204 without a JSON body", async () => {
  const api = load("api/instance.ts", async () => response(204))
  api.saveTokens(old)
  assert.equal(
    await api.authorizedRequest("/account/logout", { method: "POST" }),
    null,
  )
})

test("logout with an expired token does not refresh a closing session", async () => {
  let calls = 0
  const api = load("api/instance.ts", async () => {
    calls++
    return response(401, { details: { error: "TOKEN_EXPIRED" } })
  })
  api.saveTokens(old)
  await assert.rejects(
    api.authorizedRequest(
      "/account/logout",
      { method: "POST" },
      { refreshOnExpired: false },
    ),
  )
  assert.equal(calls, 1)
  assert.equal(api.readTokens(), null)
})

test("an old account mutation is not retried after another sign-in", async () => {
  let api,
    calls = 0
  api = load("api/instance.ts", async () => {
    calls++
    api.replaceSession(next)
    return response(401, { details: { error: "TOKEN_EXPIRED" } })
  })
  api.saveTokens(old)
  await assert.rejects(
    api.authorizedRequest("/account/avatar", { method: "DELETE" }),
  )
  assert.equal(calls, 1)
  assert.equal(api.readTokens().accessToken, next.accessToken)
})

test("refresh cannot retry an account mutation with another session's tokens", async () => {
  let api,
    calls = 0
  api = load("api/instance.ts", async (url) => {
    calls++
    if (url.endsWith("/auth/refresh")) {
      api.replaceSession(next)
      return response(200, next)
    }
    return response(401, { details: { error: "TOKEN_EXPIRED" } })
  })
  api.saveTokens(old)
  await assert.rejects(
    api.authorizedRequest("/account/avatar", { method: "DELETE" }),
  )
  assert.equal(calls, 2)
  assert.equal(api.readTokens().accessToken, next.accessToken)
})

test("dictionary names follow locale and retain unknown codes", () => {
  const { resolveDictionaryLocale, getDictionaryName, getCityName } = load(
    "lib/dictionaries/helpers.ts",
  )
  const entries = [{ code: "NEW_TYPE", nameRu: "Помощь", nameBe: "Дапамога" }]
  assert.equal(resolveDictionaryLocale("be", "ru"), "be")
  assert.equal(resolveDictionaryLocale(null, "be-BY"), "be")
  assert.equal(resolveDictionaryLocale("ru", "be"), "ru")
  assert.equal(getDictionaryName(entries, "NEW_TYPE", "be"), "Дапамога")
  assert.equal(getDictionaryName(entries, "DISABLED", "ru"), "DISABLED")
  assert.equal(getDictionaryName(undefined, "NEW_TYPE", "ru"), "NEW_TYPE")
  assert.equal(getCityName(undefined, null, "ru"), "")
})

test("city search matches both names and codes, preserves grouping and center", () => {
  const { filterCities, getCityName } = load("lib/dictionaries/helpers.ts")
  const center = {
    code: "mogilev",
    nameRu: "Могилёв",
    nameBe: "Магілёў",
    latitude: 53,
    longitude: 30,
  }
  const city = {
    code: "gorki",
    nameRu: "Горки",
    nameBe: "Горкі",
    latitude: 54,
    longitude: 31,
  }
  const groups = [{ region: "MOGILEV", center, cities: [center, city] }]
  assert.equal(filterCities(groups, " МОГИЛЕВ ")[0].cities[0].code, "mogilev")
  const filtered = filterCities(groups, "ГОРКІ")
  assert.equal(filtered[0].center.code, "mogilev")
  assert.equal(filtered[0].cities.length, 1)
  assert.equal(filterCities(groups, "GORKI")[0].cities[0].code, "gorki")
  assert.equal(filterCities(groups, "unknown").length, 0)
  assert.equal(groups[0].cities.length, 2)
  assert.equal(getCityName(groups, "gorki", "be"), "Горкі")
})

test("dictionary endpoints use expected auth and preserve backend errors", async () => {
  const storage = new Map()
  storage.set(
    "lapalink.session",
    JSON.stringify({ accessToken: "access", refreshToken: "refresh" }),
  )
  const paths = []
  const { dictionariesApi } = load(
    "api/dictionaries.ts",
    async (url, options) => {
      paths.push(url)
      const hasAuth = options.headers.has("Authorization")
      assert.equal(
        hasAuth,
        url.endsWith("/need-types") || url.endsWith("/case-close-reasons"),
      )
      return response(200, [])
    },
    storage,
  )
  await dictionariesApi.cities()
  await dictionariesApi.needTypes()
  await dictionariesApi.closeReasons()
  assert.deepEqual(paths, [
    "/api/v1/cities",
    "/api/v1/need-types",
    "/api/v1/case-close-reasons",
  ])
  const failed = load("api/dictionaries.ts", async () =>
    response(503, {
      message: "Текст сервера",
      details: { error: "TECHNICAL_ERROR" },
    }),
  )
  await assert.rejects(
    failed.dictionariesApi.cities(),
    (error) => error.message === "Текст сервера",
  )
})

test("dictionary cache shares requests and survives sign-in and logout", async () => {
  const { QueryClient } = nodeRequire("@tanstack/react-query")
  let calls = 0
  const modules = load("hooks/model/dictionaryQueries.ts", async () => {
    calls++
    return response(200, [])
  })
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const options = modules.dictionaryQueries.cities()
  assert.equal(options.staleTime, Infinity)
  assert.equal(options.gcTime, Infinity)
  await Promise.all([client.fetchQuery(options), client.fetchQuery(options)])
  await client.fetchQuery(options)
  assert.equal(calls, 1)
  client.setQueryData(["account", "me", "old"], { id: "old" })
  const actions = load("hooks/model/sessionActions.ts", async (url) =>
    url.endsWith("/account/logout")
      ? response(204)
      : response(200, { id: "new" }),
  )
  await actions.completeSignIn(client, old)
  assert.ok(client.getQueryData(options.queryKey))
  assert.equal(client.getQueryData(["account", "me", "old"]), undefined)
  await actions.logoutSession(client)
  assert.ok(client.getQueryData(options.queryKey))
  await client.invalidateQueries({ queryKey: options.queryKey })
  await client.fetchQuery(options)
  assert.equal(calls, 2)
  client.clear()
})

test("case validation enforces required fields, coordinates and text limits", () => {
  const { createCaseSchema, toCreateCaseDto } = load(
    "components/pages/CreateCase/schemas.ts",
  )
  const values = {
    animalType: "CAT",
    title: " Найден кот ",
    cityCode: "minsk",
    latitude: "53,9",
    longitude: "27.56",
    sex: "UNKNOWN",
    description: "",
    approximateAge: "",
    condition: "",
    needTypes: ["NEW_TYPE"],
  }
  const valid = createCaseSchema.safeParse(values)
  assert.equal(valid.success, true)
  const dto = toCreateCaseDto(valid.data)
  assert.equal(dto.title, "Найден кот")
  assert.equal(dto.latitude, 53.9)
  assert.equal("city" in dto, false)
  assert.equal("needTypes" in dto, false)
  assert.equal("description" in dto, false)
  for (const patch of [
    { title: " " },
    { title: "x".repeat(151) },
    { cityCode: "" },
    { animalType: "BIRD" },
    { latitude: "" },
    { latitude: "NaN" },
    { latitude: "91" },
    { longitude: "181" },
    { description: "x".repeat(2001) },
    { approximateAge: "x".repeat(51) },
    { condition: "x".repeat(501) },
    { needTypes: ["FOOD", "FOOD"] },
  ])
    assert.equal(
      createCaseSchema.safeParse({ ...values, ...patch }).success,
      false,
    )
  assert.equal(
    createCaseSchema.safeParse({ ...values, latitude: "-90", longitude: "180" })
      .success,
    true,
  )
})

test("case creation sends JSON without photo and typed multipart with photo", async () => {
  const storage = new Map([["lapalink.session", JSON.stringify(old)]])
  const received = []
  const { casesApi } = load(
    "api/cases.ts",
    async (url, options) => {
      received.push({ url, options })
      return response(201, { id: "case-1" })
    },
    storage,
  )
  const dto = {
    animalType: "DOG",
    title: "Найдена собака",
    cityCode: "minsk",
    latitude: 53.9,
    longitude: 27.56,
  }
  await casesApi.create(dto)
  assert.equal(
    received[0].options.headers.get("Content-Type"),
    "application/json",
  )
  assert.equal(JSON.parse(received[0].options.body).cityCode, "minsk")
  const photo = new File(["photo"], "dog.png", { type: "image/png" })
  await casesApi.create(dto, photo)
  const multipart = received[1].options
  assert.equal(multipart.headers.has("Content-Type"), false)
  assert.equal(multipart.body.get("case").type, "application/json")
  assert.equal(
    JSON.parse(await multipart.body.get("case").text()).cityCode,
    "minsk",
  )
  assert.equal(multipart.body.get("photo").name, "dog.png")
  assert.equal(multipart.headers.get("Authorization"), "Bearer old-access")
  await casesApi.addNeed("case-1", "NEW_TYPE")
  assert.equal(received[2].url, "/api/v1/cases/case-1/needs")
  assert.equal(JSON.parse(received[2].options.body).type, "NEW_TYPE")
})

test("animal age accepts numeric years/months and rejects free-form letters", () => {
  const { approximateAgeSchema } = load("lib/validation/age.ts")
  for (const value of ["", "2", "2 лет", "6 месяцев", "1 год"])
    assert.equal(approximateAgeSchema.safeParse(value).success, true, value)
  for (const value of ["котёнок", "abc", "-2", "2e4", "1.5", "1234"])
    assert.equal(approximateAgeSchema.safeParse(value).success, false, value)
})

test("API propagates cancellation and turns a deadline into a recoverable error", async () => {
  const cancelled = new AbortController()
  cancelled.abort()
  const api = load("api/instance.ts", async (_url, options) => {
    throw options.signal.reason
  })
  await assert.rejects(api.request("/cases", { signal: cancelled.signal }), {
    name: "AbortError",
  })
  const expired = AbortSignal.abort(new DOMException("Expired", "TimeoutError"))
  const timed = load(
    "api/instance.ts",
    async (_url, options) => {
      throw options.signal.reason
    },
    undefined,
    undefined,
    {
      AbortSignal: {
        timeout: (ms) => {
          assert.equal(ms, 20_000)
          return expired
        },
        any: AbortSignal.any,
      },
    },
  )
  await assert.rejects(timed.request("/cases"), {
    message: "Сервер отвечает слишком долго. Попробуйте ещё раз.",
  })
})

test("navigation serializes rapid links and recovers a stalled transition", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] })
  const React = nodeRequire("react")
  let pending = false
  let pathname = "/cases"
  let effect
  const ref = { current: null }
  const pushed = []
  const assigned = []
  const { NavigationProvider } = load(
    "components/providers/NavigationProvider.tsx",
    undefined,
    undefined,
    undefined,
    {
      react: {
        ...React,
        useRef: () => ref,
        useTransition: () => [pending, (callback) => callback()],
        useEffect: (callback) => {
          effect = callback
        },
      },
      "next/navigation": {
        usePathname: () => pathname,
        useRouter: () => ({ push: (href) => pushed.push(href) }),
      },
      "next/link": { default: "a" },
      window: { location: { assign: (href) => assigned.push(href) } },
    },
  )
  let tree = NavigationProvider({ children: null })
  effect()
  tree.props.value("/cases")
  assert.equal(pushed.length, 0)
  tree.props.value("/account")
  tree.props.value("/my-tasks")
  tree.props.value("/account")
  assert.deepEqual(pushed, ["/account"])
  pathname = "/account"
  tree = NavigationProvider({ children: null })
  effect()
  tree.props.value("/my-cases")
  assert.deepEqual(pushed, ["/account", "/my-cases"])
  pending = true
  NavigationProvider({ children: null })
  const cleanup = effect()
  t.mock.timers.tick(20_000)
  assert.deepEqual(assigned, ["/my-cases"])
  cleanup()
})

test("profile validation enforces backend limits and trims the name", () => {
  const { profileSchema } = load("components/pages/Account/schemas.ts")
  assert.equal(
    profileSchema.parse({ displayName: " Анна ", cityCode: "minsk", bio: "" })
      .displayName,
    "Анна",
  )
  for (const fields of [
    { displayName: " " },
    { displayName: "a".repeat(101) },
    { cityCode: "a".repeat(65) },
    { bio: "a".repeat(1001) },
  ]) {
    assert.equal(
      profileSchema.safeParse({
        displayName: "Анна",
        cityCode: "__none",
        bio: "",
        ...fields,
      }).success,
      false,
    )
  }
})

test("profile saves the exact DTO and publishes the current user without reloading", async () => {
  const updated = {
    id: "user",
    displayName: "Анна",
    profile: { cityCode: null, bio: null },
  }
  let received
  const api = load("api/instance.ts", async (url, options) => {
    received = { url, method: options.method, body: JSON.parse(options.body) }
    return response(200, updated)
  })
  api.saveTokens(old)
  const { accountApi } = load(
    "api/account.ts",
    async (url, options) => {
      received = { url, method: options.method, body: JSON.parse(options.body) }
      return response(200, updated)
    },
    undefined,
    undefined,
    { "./instance": api },
  )
  const dto = { displayName: "Анна", cityCode: null, bio: null }
  assert.equal((await accountApi.updateProfile(dto)).displayName, "Анна")
  assert.equal(received.url, "/api/v1/account/profile")
  assert.equal(received.method, "PUT")
  assert.deepEqual(received.body, dto)
  let cached = { id: "user", displayName: "До изменения" }
  let invalidated = false
  const { useUpdateProfile } = load(
    "hooks/useAccountMutations.ts",
    undefined,
    undefined,
    undefined,
    {
      "@/api": {
        accountApi: { updateProfile: async () => updated },
        ApiError: api.ApiError,
      },
      "@/lib/auth": { getSessionRevision: () => 1, readTokens: () => old },
      "./model/accountQuery": { ACCOUNT_QUERY_KEY: ["account", "me"] },
      "@tanstack/react-query": {
        useMutation: (options) => options,
        useQueryClient: () => ({
          cancelQueries: async () => {},
          setQueriesData: (_, apply) => {
            cached = apply(cached)
          },
          invalidateQueries: () => {
            invalidated = true
          },
        }),
      },
    },
  )
  await useUpdateProfile().mutationFn(dto)
  assert.equal(cached, updated)
  assert.equal(invalidated, true)
})
