import { test } from "node:test"
import assert from "node:assert/strict"
import vm from "node:vm"
import fs from "node:fs"
import ts from "typescript"
import path from "node:path"
import { createRequire } from "node:module"

const nodeRequire = createRequire(import.meta.url)

// Pass an array to load several files through one module graph (shared ApiError class).
function load(file, { fetch, local = new Map(), session = new Map(), overrides = {} } = {}) {
  const storage = (map) => ({
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  })
  const context = {
    AbortSignal,
    AbortController,
    setTimeout,
    clearTimeout,
    URL,
    Headers,
    Response,
    TextEncoder,
    FormData,
    localStorage: storage(local),
    sessionStorage: storage(session),
    window: { dispatchEvent() {} },
    navigator: { language: "be-BY" },
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
        fs.existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, "index.ts"),
      )
    }
    vm.runInNewContext(`(function(exports, require) { ${compiled}\n})`, context)(
      exports,
      requireModule,
    )
    return exports
  }
  return Array.isArray(file) ? file.map(loadModule) : loadModule(file)
}
const response = (status, body, headers = {}) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
const failure = (status, error, message = "Ошибка", extra = {}) =>
  response(status, {
    message,
    details: { errorId: "id", errorCode: String(status), error, ...extra },
  })
const stale = { accessToken: "old-access", refreshToken: "old-refresh" }

test("reset form validation: 6-digit code, 8 chars, 72 UTF-8 bytes, matching confirmation", () => {
  const { forgotPasswordSchema, resetPasswordSchema } = load(
    "components/pages/Auth/schemas.ts",
  )
  assert.equal(
    forgotPasswordSchema.parse({ email: " user@example.com " }).email,
    "user@example.com",
  )
  assert.equal(forgotPasswordSchema.safeParse({ email: "" }).success, false)
  assert.equal(forgotPasswordSchema.safeParse({ email: "bad" }).success, false)
  const valid = { code: "012345", newPassword: "NewStrongPass123", confirmPassword: "NewStrongPass123" }
  assert.equal(resetPasswordSchema.safeParse(valid).success, true)
  for (const code of ["12345", "1234567", "abcdef", "12 345"])
    assert.equal(resetPasswordSchema.safeParse({ ...valid, code }).success, false)
  const password = (newPassword) =>
    resetPasswordSchema.safeParse({ ...valid, newPassword, confirmPassword: newPassword })
  assert.equal(password("short").success, false)
  assert.equal(password("я".repeat(36)).success, true)
  assert.equal(password("я".repeat(37)).success, false)
  const mismatch = resetPasswordSchema.safeParse({ ...valid, confirmPassword: "Other1234" })
  assert.deepEqual(mismatch.error.issues.map((issue) => issue.path), [["confirmPassword"]])
})

test("forgot/reset are public: no Authorization even with stale tokens, Accept-Language is sent", async () => {
  const calls = []
  const local = new Map([["lapalink.session", JSON.stringify(stale)]])
  const { authApi } = load("api/auth.ts", {
    local,
    fetch: async (url, options) => {
      calls.push([url, options.method, options.headers.get("Authorization"), options.headers.get("Accept-Language"), options.body])
      return url.endsWith("forgot")
        ? response(200, { requestId: "r1", expiresInSeconds: 600, resendAvailableInSeconds: 60 })
        : response(204)
    },
  })
  assert.equal((await authApi.forgotPassword("user@example.com")).requestId, "r1")
  assert.equal(
    await authApi.resetPassword({ requestId: "r1", code: "123456", newPassword: "NewStrongPass123" }),
    null,
  )
  assert.deepEqual(calls, [
    ["/api/v1/auth/password/forgot", "POST", null, "be", '{"email":"user@example.com"}'],
    ["/api/v1/auth/password/reset", "POST", null, "be", '{"requestId":"r1","code":"123456","newPassword":"NewStrongPass123"}'],
  ])
})

test("reset errors map to UI actions: OTP_INVALID, OTP_EXPIRED, OTP_ATTEMPTS_EXCEEDED and limits", async () => {
  const cases = [
    [failure(401, "OTP_INVALID", "Неверный код подтверждения."), "invalid-code"],
    [failure(401, "OTP_EXPIRED"), "expired"],
    [failure(429, "OTP_ATTEMPTS_EXCEEDED"), "exhausted"],
    [failure(429, "OTP_DAILY_LIMIT_EXCEEDED"), "locked"],
    [failure(429, "OTP_RESEND_TOO_OFTEN"), "throttled"],
    [failure(429, "RATE_LIMITED"), "throttled"],
    [failure(429, "IP_BLOCKED"), "throttled"],
    [failure(409, "OPERATION_IN_PROGRESS"), "in-progress"],
    [failure(400, "VALIDATION_FAILED"), "show-error"],
    [response(502, null), "unknown"],
  ]
  for (const [reply, expected] of cases) {
    const [{ authApi }, { getPasswordResetErrorAction }] = load(
      ["api/auth.ts", "components/pages/Auth/passwordResetErrors.ts"],
      { fetch: async () => reply },
    )
    const error = await authApi
      .resetPassword({ requestId: "r1", code: "000000", newPassword: "NewStrongPass123" })
      .catch((error) => error)
    assert.equal(getPasswordResetErrorAction(error), expected, expected)
  }
  const { getPasswordResetErrorAction } = load("components/pages/Auth/passwordResetErrors.ts")
  assert.equal(getPasswordResetErrorAction(new TypeError("offline")), "unknown")
})

test("invalid code keeps the localized backend message; 429 exposes Retry-After", async () => {
  const replies = [
    failure(401, "OTP_INVALID", "Няправільны код."),
    response(429, { message: "Пачакайце", details: { error: "RATE_LIMITED" } }, { "Retry-After": "42" }),
  ]
  const { authApi } = load("api/auth.ts", { fetch: async () => replies.shift() })
  const dto = { requestId: "r1", code: "000000", newPassword: "NewStrongPass123" }
  await assert.rejects(authApi.resetPassword(dto), { status: 401, code: "OTP_INVALID", message: "Няправільны код." })
  await assert.rejects(authApi.resetPassword(dto), { status: 429, retryAfterSeconds: 42 })
})

test("VALIDATION_FAILED field details reach the form, service keys do not", async () => {
  const { post } = load("api/instance.ts", {
    fetch: async () =>
      failure(400, "VALIDATION_FAILED", "Проверьте поля", { newPassword: "Слишком короткий" }),
  })
  await assert.rejects(post("/auth/password/reset", {}), (error) => {
    assert.deepEqual({ ...error.fields }, { newPassword: "Слишком короткий" })
    assert.equal(error.code, "VALIDATION_FAILED")
    return true
  })
})

test("resend replaces requestId; burnt or finished flows leave no request in storage", () => {
  const session = new Map()
  const auth = load("lib/auth/index.ts", { session })
  const first = auth.savePendingPasswordReset(
    { requestId: "r1", expiresInSeconds: 600, resendAvailableInSeconds: 60 },
    "user@example.com",
  )
  assert.ok(first.resendAt - Date.now() > 55_000 && first.expiresAt - Date.now() > 595_000)
  auth.savePendingPasswordReset(
    { requestId: "r2", expiresInSeconds: 300, resendAvailableInSeconds: 30 },
    "user@example.com",
  )
  assert.equal(auth.readPendingPasswordReset().requestId, "r2")
  assert.equal([...session.values()].join().includes("password"), false)
  auth.clearPendingPasswordReset()
  assert.equal(auth.readPendingPasswordReset(), null)
  auth.setPasswordResetEmail("user@example.com")
  assert.equal(auth.takePasswordResetEmail(), "user@example.com")
  assert.equal(auth.takePasswordResetEmail(), "")
  auth.markPasswordResetDone()
  assert.equal(auth.takePasswordResetDone(), true)
  assert.equal(auth.takePasswordResetDone(), false)
})

test("successful reset drops local tokens and private caches; a failed one keeps the session", async () => {
  const local = new Map([["lapalink.session", JSON.stringify(stale)]])
  const replies = [failure(401, "OTP_INVALID"), response(204)]
  const removed = []
  let mutation
  const hooks = load("hooks/useAuthMutations.ts", {
    local,
    fetch: async (url, options) => {
      assert.equal(options.headers.get("Authorization"), null)
      return replies.shift()
    },
    overrides: {
      "@tanstack/react-query": {
        useQueryClient: () => ({
          cancelQueries: async () => {},
          removeQueries: (filter) => removed.push(filter),
        }),
        useMutation: (options) => {
          mutation = options
          return {}
        },
      },
    },
  })
  hooks.useResetPassword()
  const dto = { requestId: "r1", code: "123456", newPassword: "NewStrongPass123" }
  await assert.rejects(mutation.mutationFn(dto), { code: "OTP_INVALID" })
  assert.ok(local.has("lapalink.session"))
  assert.equal(removed.length, 0)
  await mutation.mutationFn(dto)
  assert.equal(local.has("lapalink.session"), false)
  assert.equal(removed.length, 1)
  assert.equal(removed[0].predicate({ queryKey: ["account"] }), true)
})
