import { test } from "node:test"
import assert from "node:assert/strict"
import { failure, load, response } from "./otp-loader.mjs"

const tokens = { accessToken: "new-access", refreshToken: "new-refresh" }
const codeReply = () =>
  response(200, { requestId: "r1", expiresInSeconds: 60, resendAvailableInSeconds: 60 })
const confirmReply = (type = "EMAIL_VERIFICATION") =>
  response(200, { confirmationToken: "token-1", type, expiresInSeconds: 600 })
const FLOW_KEYS = ["lapalink.registration", "lapalink.registration-confirmation"]
const FLOW_FILES = [
  "components/pages/Auth/otpFlow.ts",
  "components/pages/Auth/registrationFlow.ts",
  "api/auth.ts",
  "lib/auth/index.ts",
]

// Flow, API and storage share one module graph and one sessionStorage.
function loadFlow(fetch, { session = new Map(), local = new Map(), overrides } = {}) {
  const [otp, registration, { authApi }, auth, hooks] = load(
    overrides ? [...FLOW_FILES, "hooks/useAuthMutations.ts"] : FLOW_FILES,
    { fetch, session, local, overrides },
  )
  const flow = registration.registrationFlow
  return { otp, registration, flow, authApi, auth, hooks, session, local }
}
async function sendCode(otp, flow, authApi) {
  return otp.requestOtpCode(flow, "user@example.com", authApi.register)
}

test("registration endpoints are public and never use userId or /verification", async () => {
  const calls = []
  const local = new Map([["lapalink.session", JSON.stringify({ accessToken: "old", refreshToken: "old" })]])
  const { authApi } = load("api/auth.ts", {
    local,
    fetch: async (url, options) => {
      calls.push([url, options.headers.get("Authorization"), options.headers.get("Accept-Language"), options.body])
      if (url.endsWith("/registration")) return codeReply()
      if (url.endsWith("/confirm")) return confirmReply()
      return response(200, tokens)
    },
  })
  assert.equal(authApi.verify, undefined)
  assert.equal(authApi.resend, undefined)
  await authApi.register("user@example.com")
  await authApi.confirmOtp({ requestId: "r1", code: "123456" })
  assert.deepEqual(
    { ...(await authApi.completeRegistration({ confirmationToken: "token-1", password: "GoodPass123", displayName: "Анна" })) },
    tokens,
  )
  assert.deepEqual(calls, [
    ["/api/v1/auth/registration", null, "be", '{"email":"user@example.com"}'],
    ["/api/v1/auth/otp/confirm", null, "be", '{"requestId":"r1","code":"123456"}'],
    ["/api/v1/auth/registration/complete", null, "be", '{"confirmationToken":"token-1","password":"GoodPass123","displayName":"Анна"}'],
  ])
})

test("full flow: email → code → password and name → signed in without a second login", async () => {
  const calls = []
  const removed = []
  let mutation
  const fetch = async (url, options) => {
    calls.push([url, options.headers.get("Authorization")])
    if (url.endsWith("/registration")) return codeReply()
    if (url.endsWith("/confirm")) return confirmReply()
    if (url.endsWith("/complete")) return response(200, tokens)
    return response(200, { id: "u1", email: "user@example.com", displayName: "Анна", roles: [] })
  }
  const { otp, registration, flow, authApi, auth, hooks, session, local } = loadFlow(fetch, {
    overrides: {
      "@tanstack/react-query": {
        queryOptions: (options) => options,
        useQueryClient: () => ({
          cancelQueries: async () => {},
          removeQueries: (filter) => removed.push(filter),
          fetchQuery: (options) => options.queryFn({}),
        }),
        useMutation: (options) => {
          mutation = options
          return {}
        },
      },
    },
  })
  assert.deepEqual({ ...(await sendCode(otp, flow, authApi)) }, { redirect: "/register/code" })
  const code = otp.openOtpCodeStep(flow)
  assert.equal(code.pending.requestId, "r1")
  const confirmed = await otp.confirmOtpCode(flow, code.pending, "123456", authApi.confirmOtp)
  assert.deepEqual({ ...confirmed }, { redirect: "/register/complete" })
  assert.equal(auth.registrationStorage.readPending(), null)
  const step = otp.openConfirmedStep(flow)
  hooks.useCompleteRegistration()
  const done = await registration.submitRegistration(
    step.confirmation,
    { password: "GoodPass123", displayName: "Анна" },
    mutation.mutationFn,
  )
  assert.deepEqual({ ...done }, { redirect: "/welcome" })
  assert.deepEqual(JSON.parse(local.get("lapalink.session")), tokens)
  assert.deepEqual(calls.at(-1), ["/api/v1/account/me", "Bearer new-access"])
  assert.equal(FLOW_KEYS.some((key) => session.has(key)), false)
  assert.equal(removed.length, 1)
})

test("USER_ALREADY_EXISTS on step 1 stays on the email screen without a request", async () => {
  const { otp, flow, authApi, auth } = loadFlow(async () =>
    failure(409, "USER_ALREADY_EXISTS", "Аккаунт уже существует."),
  )
  const result = await sendCode(otp, flow, authApi)
  assert.equal(result.action, "already-exists")
  assert.equal(result.redirect, undefined)
  assert.equal(auth.registrationStorage.readPending(), null)
})

test("OTP_INVALID and OTP_EXPIRED keep the user on the code screen", async () => {
  for (const [reply, action] of [
    [failure(401, "OTP_INVALID", "Неверный код."), "invalid-code"],
    [failure(401, "OTP_EXPIRED", "Код истёк."), "expired"],
  ]) {
    const replies = [codeReply(), reply]
    const { otp, flow, authApi, auth } = loadFlow(async () => replies.shift())
    await sendCode(otp, flow, authApi)
    const pending = auth.registrationStorage.readPending()
    const result = await otp.confirmOtpCode(flow, pending, "000000", authApi.confirmOtp)
    assert.equal(result.action, action)
    assert.equal(auth.registrationStorage.readPending().requestId, "r1")
    assert.equal(auth.registrationStorage.readConfirmation(), null)
  }
})

test("a code of another type restarts registration from the email screen", async () => {
  const replies = [codeReply(), confirmReply("PASSWORD_RESET")]
  const { otp, flow, authApi, auth, session } = loadFlow(async () => replies.shift())
  await sendCode(otp, flow, authApi)
  const result = await otp.confirmOtpCode(flow, auth.registrationStorage.readPending(), "123456", authApi.confirmOtp)
  assert.deepEqual({ ...result }, { redirect: "/register", toast: otp.GENERIC_ERROR })
  assert.equal(FLOW_KEYS.some((key) => session.has(key)), false)
  assert.equal(auth.registrationStorage.takeEmail(), "user@example.com")
})

test("OTP_CONFIRMATION_INVALID on step 3 returns to step 1 with the email prefilled", async () => {
  const { registration, authApi, auth, session } = loadFlow(async () =>
    failure(401, "OTP_CONFIRMATION_INVALID", "Подтверждение недействительно."),
  )
  const confirmation = auth.registrationStorage.saveConfirmation("token-1", "user@example.com", 600)
  const result = await registration.submitRegistration(
    confirmation,
    { password: "GoodPass123", displayName: "Анна" },
    authApi.completeRegistration,
  )
  assert.deepEqual({ ...result }, { redirect: "/register", toast: registration.REGISTRATION_EXPIRED })
  assert.equal(FLOW_KEYS.some((key) => session.has(key)), false)
  assert.equal(auth.registrationStorage.takeEmail(), "user@example.com")
})

test("EMAIL_ALREADY_VERIFIED on step 3 sends the user to sign in", async () => {
  const { registration, authApi, auth, session } = loadFlow(async () =>
    failure(400, "EMAIL_ALREADY_VERIFIED"),
  )
  const confirmation = auth.registrationStorage.saveConfirmation("token-1", "user@example.com", 600)
  const result = await registration.submitRegistration(
    confirmation,
    { password: "GoodPass123", displayName: "Анна" },
    authApi.completeRegistration,
  )
  assert.deepEqual({ ...result }, { redirect: "/login", toast: registration.ALREADY_REGISTERED })
  assert.equal(FLOW_KEYS.some((key) => session.has(key)), false)
})

test("direct visit to step 3 without a token goes to step 1; code screen without requestId too", () => {
  const { otp, flow, auth } = loadFlow()
  assert.deepEqual({ ...otp.openConfirmedStep(flow) }, { redirect: "/register" })
  assert.deepEqual({ ...otp.openOtpCodeStep(flow) }, { redirect: "/register" })
  auth.registrationStorage.saveConfirmation("token-1", "user@example.com", 600)
  assert.equal(otp.openConfirmedStep(flow).confirmation.confirmationToken, "token-1")
  assert.equal(otp.openOtpCodeStep(flow).redirect, "/register/complete")
})

test("login with EMAIL_NOT_VERIFIED → «Продолжить регистрацию» → code screen", async () => {
  const replies = [failure(403, "EMAIL_NOT_VERIFIED", "Почта не подтверждена."), codeReply()]
  const { otp, flow, authApi } = loadFlow(async () => replies.shift())
  await assert.rejects(authApi.login({ email: "user@example.com", password: "any" }), {
    status: 403,
    code: "EMAIL_NOT_VERIFIED",
  })
  const result = await otp.requestOtpCode(flow, "user@example.com", authApi.register)
  assert.deepEqual({ ...result }, { redirect: "/register/code" })
  const step = otp.openOtpCodeStep(flow)
  assert.deepEqual(
    [step.pending.requestId, step.pending.email],
    ["r1", "user@example.com"],
  )
})

test("continuing registration right after a code was sent reports OTP_RESEND_TOO_OFTEN without Retry-After", async () => {
  const { otp, flow, authApi, auth } = loadFlow(async () =>
    failure(429, "OTP_RESEND_TOO_OFTEN", "Код уже отправлен."),
  )
  const result = await otp.requestOtpCode(flow, "user@example.com", authApi.register)
  assert.equal(result.action, "throttled")
  assert.equal(result.error.code, "OTP_RESEND_TOO_OFTEN")
  assert.equal(result.error.retryAfterSeconds, undefined)
  assert.equal(auth.registrationStorage.readPending(), null)
})
