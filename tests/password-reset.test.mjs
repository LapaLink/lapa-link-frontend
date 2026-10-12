import { test } from "node:test"
import assert from "node:assert/strict"
import { failure, load, response } from "./otp-loader.mjs"

const stale = { accessToken: "old-access", refreshToken: "old-refresh" }

test("reset steps validation: 6-digit code, then 8 chars, 72 UTF-8 bytes, matching confirmation", () => {
  const { forgotPasswordSchema, verificationSchema, newPasswordSchema } = load(
    "components/pages/Auth/schemas.ts",
  )
  assert.equal(
    forgotPasswordSchema.parse({ email: " user@example.com " }).email,
    "user@example.com",
  )
  assert.equal(forgotPasswordSchema.safeParse({ email: "" }).success, false)
  assert.equal(forgotPasswordSchema.safeParse({ email: "bad" }).success, false)
  assert.equal(verificationSchema.safeParse({ code: "012345" }).success, true)
  for (const code of ["12345", "1234567", "abcdef", "12 345"])
    assert.equal(verificationSchema.safeParse({ code }).success, false)
  const valid = { newPassword: "NewStrongPass123", confirmPassword: "NewStrongPass123" }
  assert.equal(newPasswordSchema.safeParse(valid).success, true)
  const password = (newPassword) =>
    newPasswordSchema.safeParse({ newPassword, confirmPassword: newPassword })
  assert.equal(password("short").success, false)
  assert.equal(password("я".repeat(36)).success, true)
  assert.equal(password("я".repeat(37)).success, false)
  const mismatch = newPasswordSchema.safeParse({ ...valid, confirmPassword: "Other1234" })
  assert.deepEqual(mismatch.error.issues.map((issue) => issue.path), [["confirmPassword"]])
})

const forgotReply = () =>
  response(200, { requestId: "r1", expiresInSeconds: 600, resendAvailableInSeconds: 60 })
const confirmReply = (type = "PASSWORD_RESET") =>
  response(200, { confirmationToken: "token-1", type, expiresInSeconds: 600 })
const RESET_KEYS = ["lapalink.password-reset", "lapalink.password-reset-confirmation"]

const FLOW_FILES = [
  "components/pages/Auth/otpFlow.ts",
  "components/pages/Auth/passwordResetFlow.ts",
  "api/auth.ts",
  "lib/auth/index.ts",
]
// The shared OTP steps bound to the password reset flow.
function bindResetFlow(otp, reset) {
  const config = reset.passwordResetFlow
  return {
    GENERIC_ERROR: otp.GENERIC_ERROR,
    CONFIRMATION_EXPIRED: reset.CONFIRMATION_EXPIRED,
    confirmPasswordResetCode: (pending, code, confirm) =>
      otp.confirmOtpCode(config, pending, code, confirm),
    openCodeStep: () => otp.openOtpCodeStep(config),
    openNewPasswordStep: () => otp.openConfirmedStep(config),
    submitNewPassword: reset.submitNewPassword,
  }
}

// Flow, API and storage share one module graph and one sessionStorage.
function loadFlow(fetch, session = new Map()) {
  const [otp, reset, { authApi }, auth] = load(FLOW_FILES, { fetch, session })
  return { flow: bindResetFlow(otp, reset), authApi, auth, session }
}

test("forgot, OTP confirm and reset are public; reset sends only the confirmation token", async () => {
  const calls = []
  const local = new Map([["lapalink.session", JSON.stringify(stale)]])
  const { authApi } = load("api/auth.ts", {
    local,
    fetch: async (url, options) => {
      calls.push([url, options.method, options.headers.get("Authorization"), options.headers.get("Accept-Language"), options.body])
      if (url.endsWith("forgot")) return forgotReply()
      if (url.endsWith("confirm")) return confirmReply()
      return response(204)
    },
  })
  assert.equal((await authApi.forgotPassword("user@example.com")).requestId, "r1")
  assert.equal((await authApi.confirmOtp({ requestId: "r1", code: "123456" })).confirmationToken, "token-1")
  assert.equal(await authApi.resetPassword({ confirmationToken: "token-1", newPassword: "NewStrongPass123" }), null)
  assert.deepEqual(calls, [
    ["/api/v1/auth/password/forgot", "POST", null, "be", '{"email":"user@example.com"}'],
    ["/api/v1/auth/otp/confirm", "POST", null, "be", '{"requestId":"r1","code":"123456"}'],
    ["/api/v1/auth/password/reset", "POST", null, "be", '{"confirmationToken":"token-1","newPassword":"NewStrongPass123"}'],
  ])
})

test("OTP confirm and reset errors map to UI actions", async () => {
  const cases = [
    ["confirmOtp", failure(401, "OTP_INVALID", "Неверный код подтверждения."), "invalid-code"],
    ["confirmOtp", failure(401, "OTP_EXPIRED"), "expired"],
    ["confirmOtp", failure(429, "OTP_ATTEMPTS_EXCEEDED"), "exhausted"],
    ["confirmOtp", failure(429, "OTP_DAILY_LIMIT_EXCEEDED"), "locked"],
    ["confirmOtp", failure(400, "OTP_CONFIRMATION_NOT_SUPPORTED"), "unsupported"],
    ["confirmOtp", failure(409, "OPERATION_IN_PROGRESS"), "in-progress"],
    ["confirmOtp", failure(400, "VALIDATION_FAILED", "Ошибка", { code: "6 цифр" }), "show-error"],
    ["confirmOtp", failure(429, "RATE_LIMITED"), "throttled"],
    ["forgotPassword", failure(429, "OTP_RESEND_TOO_OFTEN"), "throttled"],
    ["resetPassword", failure(401, "OTP_CONFIRMATION_INVALID"), "confirmation-invalid"],
    ["resetPassword", failure(429, "IP_BLOCKED"), "throttled"],
    ["resetPassword", failure(400, "VALIDATION_FAILED"), "show-error"],
    ["resetPassword", response(502, null), "unknown"],
  ]
  for (const [method, reply, expected] of cases) {
    const [{ authApi }, { getOtpFlowErrorAction }] = load(
      ["api/auth.ts", "components/pages/Auth/otpFlowErrors.ts"],
      { fetch: async () => reply },
    )
    const error = await authApi[method]({}).catch((error) => error)
    assert.equal(getOtpFlowErrorAction(error), expected, `${method} → ${expected}`)
  }
  const { getOtpFlowErrorAction } = load("components/pages/Auth/otpFlowErrors.ts")
  assert.equal(getOtpFlowErrorAction(new TypeError("offline")), "unknown")
})

test("invalid code keeps the localized backend message; 429 exposes Retry-After", async () => {
  const replies = [
    failure(401, "OTP_INVALID", "Няправільны код."),
    response(429, { message: "Пачакайце", details: { error: "RATE_LIMITED" } }, { "Retry-After": "42" }),
  ]
  const { authApi } = load("api/auth.ts", { fetch: async () => replies.shift() })
  const dto = { requestId: "r1", code: "000000" }
  await assert.rejects(authApi.confirmOtp(dto), { status: 401, code: "OTP_INVALID", message: "Няправільны код." })
  await assert.rejects(authApi.confirmOtp(dto), { status: 429, retryAfterSeconds: 42 })
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

test("resend replaces requestId; hand-offs are read once", () => {
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
  session.set("lapalink.password-reset-confirmation", '{"email":"user@example.com"}')
  assert.equal(auth.readPasswordResetConfirmation(), null)
  auth.setPasswordResetEmail("user@example.com")
  assert.equal(auth.takePasswordResetEmail(), "user@example.com")
  assert.equal(auth.takePasswordResetEmail(), "")
  auth.markPasswordResetDone()
  assert.equal(auth.takePasswordResetDone(), true)
  assert.equal(auth.takePasswordResetDone(), false)
})

test("confirmed code drops requestId, keeps the token and opens the new password screen", async () => {
  const { flow, authApi, auth } = loadFlow(async () => confirmReply())
  const pending = auth.savePendingPasswordReset(
    { requestId: "r1", expiresInSeconds: 600, resendAvailableInSeconds: 60 },
    "user@example.com",
  )
  const result = await flow.confirmPasswordResetCode(pending, "123456", authApi.confirmOtp)
  assert.deepEqual({ ...result }, { redirect: "/forgot-password/new-password" })
  assert.equal(auth.readPendingPasswordReset(), null)
  assert.equal(auth.readPasswordResetConfirmation().confirmationToken, "token-1")
  assert.equal(auth.readPasswordResetConfirmation().email, "user@example.com")
  // Back/reload on the code screen leads forward, the spent code is not asked again.
  assert.equal(flow.openCodeStep().redirect, "/forgot-password/new-password")
})

test("OTP_INVALID and OTP_EXPIRED stay on the code screen; a burnt code drops requestId", async () => {
  for (const [reply, action, keepsRequest] of [
    [failure(401, "OTP_INVALID", "Неверный код."), "invalid-code", true],
    [failure(401, "OTP_EXPIRED", "Код истёк."), "expired", true],
    [failure(429, "OTP_ATTEMPTS_EXCEEDED"), "exhausted", false],
  ]) {
    const { flow, authApi, auth } = loadFlow(async () => reply)
    const pending = auth.savePendingPasswordReset(
      { requestId: "r1", expiresInSeconds: 600, resendAvailableInSeconds: 60 },
      "user@example.com",
    )
    const result = await flow.confirmPasswordResetCode(pending, "000000", authApi.confirmOtp)
    assert.equal(result.action, action)
    assert.equal(result.redirect, undefined)
    assert.equal(!!auth.readPendingPasswordReset(), keepsRequest, action)
    assert.equal(auth.readPasswordResetConfirmation(), null)
  }
})

test("unsupported OTP type restarts from the email screen with the email prefilled", async () => {
  for (const reply of [confirmReply("EMAIL_CHANGE"), failure(400, "OTP_CONFIRMATION_NOT_SUPPORTED")]) {
    const { flow, authApi, auth, session } = loadFlow(async () => reply)
    const pending = auth.savePendingPasswordReset(
      { requestId: "r1", expiresInSeconds: 600, resendAvailableInSeconds: 60 },
      "user@example.com",
    )
    const result = await flow.confirmPasswordResetCode(pending, "123456", authApi.confirmOtp)
    assert.deepEqual({ ...result }, { redirect: "/forgot-password", toast: flow.GENERIC_ERROR })
    assert.equal(RESET_KEYS.some((key) => session.has(key)), false)
    assert.equal(auth.takePasswordResetEmail(), "user@example.com")
  }
})

test("direct visit without a confirmation token redirects to the email screen", () => {
  const { flow, auth } = loadFlow()
  assert.deepEqual({ ...flow.openNewPasswordStep() }, { redirect: "/forgot-password" })
  assert.deepEqual({ ...flow.openCodeStep() }, { redirect: "/forgot-password" })
  auth.savePasswordResetConfirmation("token-1", "user@example.com", 600)
  assert.equal(flow.openNewPasswordStep().confirmation.confirmationToken, "token-1")
})

test("OTP_CONFIRMATION_INVALID returns to the email screen with the email prefilled", async () => {
  const { flow, authApi, auth, session } = loadFlow(async () =>
    failure(401, "OTP_CONFIRMATION_INVALID", "Токен недействителен."),
  )
  const confirmation = auth.savePasswordResetConfirmation("token-1", "user@example.com", 600)
  const result = await flow.submitNewPassword(confirmation, "NewStrongPass123", authApi.resetPassword)
  assert.deepEqual({ ...result }, { redirect: "/forgot-password", toast: flow.CONFIRMATION_EXPIRED })
  assert.equal(RESET_KEYS.some((key) => session.has(key)), false)
  assert.equal(auth.takePasswordResetEmail(), "user@example.com")
  assert.equal(auth.takePasswordResetDone(), false)
})

test("full flow: email → code → new password → login, with tokens and flow data cleared", async () => {
  const local = new Map([["lapalink.session", JSON.stringify(stale)]])
  const session = new Map()
  const calls = []
  const replies = { forgot: forgotReply, confirm: () => confirmReply(), reset: () => response(204) }
  const removed = []
  let mutation
  const fetch = async (url, options) => {
    assert.equal(options.headers.get("Authorization"), null)
    calls.push([url, JSON.parse(options.body)])
    return replies[url.split("/").pop()]()
  }
  const [otp, reset, { authApi }, auth, hooks] = load(
    [...FLOW_FILES, "hooks/useAuthMutations.ts"],
    {
      fetch,
      local,
      session,
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
    },
  )
  const flow = bindResetFlow(otp, reset)
  const pending = auth.savePendingPasswordReset(
    await authApi.forgotPassword("user@example.com"),
    "user@example.com",
  )
  const confirmed = await flow.confirmPasswordResetCode(pending, "123456", authApi.confirmOtp)
  assert.equal(confirmed.redirect, "/forgot-password/new-password")
  const step = flow.openNewPasswordStep()
  hooks.useResetPassword()
  const done = await flow.submitNewPassword(step.confirmation, "NewStrongPass123", mutation.mutationFn)
  assert.deepEqual({ ...done }, { redirect: "/login" })
  assert.deepEqual(calls, [
    ["/api/v1/auth/password/forgot", { email: "user@example.com" }],
    ["/api/v1/auth/otp/confirm", { requestId: "r1", code: "123456" }],
    ["/api/v1/auth/password/reset", { confirmationToken: "token-1", newPassword: "NewStrongPass123" }],
  ])
  assert.equal(RESET_KEYS.some((key) => session.has(key)), false)
  assert.equal(auth.takePasswordResetDone(), true)
  assert.equal(local.has("lapalink.session"), false)
  assert.equal(removed.length, 1)
})

test("a failed reset keeps the local session", async () => {
  const local = new Map([["lapalink.session", JSON.stringify(stale)]])
  let mutation
  const hooks = load("hooks/useAuthMutations.ts", {
    local,
    fetch: async () => failure(401, "OTP_CONFIRMATION_INVALID"),
    overrides: {
      "@tanstack/react-query": {
        useQueryClient: () => ({ cancelQueries: async () => {}, removeQueries() {} }),
        useMutation: (options) => {
          mutation = options
          return {}
        },
      },
    },
  })
  hooks.useResetPassword()
  await assert.rejects(
    mutation.mutationFn({ confirmationToken: "token-1", newPassword: "NewStrongPass123" }),
    { code: "OTP_CONFIRMATION_INVALID" },
  )
  assert.ok(local.has("lapalink.session"))
})
