import { test } from "node:test"
import assert from "node:assert/strict"
import vm from "node:vm"
import fs from "node:fs"
import ts from "typescript"
import path from "node:path"
import { createRequire } from "node:module"

const nodeRequire = createRequire(import.meta.url)

function load(file, fetch, sharedStorage, locks) {
  const storage = sharedStorage || new Map()
  const context = {
    Headers,
    Response,
    Event,
    TextEncoder,
    FormData,
    File,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    window: { dispatchEvent() {} },
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
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
      },
    }).outputText
    const requireModule = (specifier) => {
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
