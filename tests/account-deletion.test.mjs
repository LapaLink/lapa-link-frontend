import { test } from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { failure, load, response } from "./otp-loader.mjs"

const nodeRequire = createRequire(import.meta.url)
const reactQuery = nodeRequire("@tanstack/react-query")
const tokens = { accessToken: "old-access", refreshToken: "old-refresh" }
const SESSION_KEY = "lapalink.session"

// Loads the deletion hook with a real QueryClient and captures its mutation.
function loadDeletion(fetch) {
  const local = new Map([[SESSION_KEY, JSON.stringify(tokens)]])
  const session = new Map()
  const client = new reactQuery.QueryClient()
  let mutation
  const [hooks, auth, api] = load(
    ["hooks/useAccountMutations.ts", "lib/auth/index.ts", "api/index.ts"],
    {
      fetch,
      local,
      session,
      overrides: {
        "@tanstack/react-query": {
          ...reactQuery,
          useQueryClient: () => client,
          useMutation: (options) => {
            mutation = options
            return {}
          },
        },
      },
    },
  )
  hooks.useDeleteAccount()
  return { mutation, auth, api, client, local, session }
}

test("account deletion posts the current password with the access token", async () => {
  const received = []
  const { mutation } = loadDeletion(async (url, options) => {
    received.push({
      url,
      method: options.method,
      auth: new Headers(options.headers).get("Authorization"),
      body: JSON.parse(options.body),
    })
    return new Response(null, { status: 204 })
  })
  await mutation.mutationFn({ password: "secret" })
  assert.deepEqual(received, [
    {
      url: "/api/v1/account/delete",
      method: "POST",
      auth: "Bearer old-access",
      body: { password: "secret" },
    },
  ])
})

test("204 drops tokens and private caches, keeps dictionaries and never calls logout or refresh", async () => {
  const urls = []
  const { mutation, auth, api, client, local } = loadDeletion(async (url) => {
    urls.push(url)
    return url.endsWith("/account/delete")
      ? new Response(null, { status: 204 })
      : failure(401, "TOKEN_EXPIRED")
  })
  client.setQueryData(["account", "me", "1:authenticated"], { id: "u1" })
  client.setQueryData(["account", "inbox", "unread-count"], { count: 3 })
  client.setQueryData(["dictionaries", "cities"], [])
  await mutation.mutationFn({ password: "secret" })
  assert.equal(local.has(SESSION_KEY), false)
  assert.equal(auth.getSessionSnapshot(), "anonymous")
  assert.equal(client.getQueryData(["account", "me", "1:authenticated"]), undefined)
  assert.equal(client.getQueryData(["account", "inbox", "unread-count"]), undefined)
  assert.deepEqual(client.getQueryData(["dictionaries", "cities"]), [])
  // The login screen shows the notice exactly once.
  assert.equal(auth.takeAccountDeleted(), true)
  assert.equal(auth.takeAccountDeleted(), false)
  // Any later private request fails locally instead of reusing the old token.
  await assert.rejects(api.authorizedRequest("/account/me"), { status: 401 })
  assert.deepEqual(urls, ["/api/v1/account/delete"])
  client.clear()
})

for (const [status, code, message] of [
  [400, "WRONG_PASSWORD", "Неверный пароль"],
  [409, "ACCOUNT_HAS_ACTIVE_TASKS", "Есть активные дела"],
]) {
  test(`${code} keeps the user signed in and preserves the backend message`, async () => {
    const { mutation, auth, local, session } = loadDeletion(async () =>
      failure(status, code, message),
    )
    await assert.rejects(mutation.mutationFn({ password: "secret" }), {
      status,
      code,
      message,
    })
    assert.deepEqual(JSON.parse(local.get(SESSION_KEY)), tokens)
    assert.notEqual(auth.getSessionSnapshot(), "anonymous")
    assert.equal(session.size, 0)
  })
}

test("deletion password: required, at most 72 UTF-8 bytes", () => {
  const { accountDeletionSchema } = load("components/pages/Account/schemas.ts")
  const valid = (password) => accountDeletionSchema.safeParse({ password }).success
  assert.equal(valid(""), false)
  assert.equal(valid("x"), true)
  assert.equal(valid("я".repeat(36)), true)
  assert.equal(valid("я".repeat(37)), false)
})

test("VALIDATION_FAILED exposes the password field error", async () => {
  const { mutation } = loadDeletion(async () =>
    response(400, {
      message: "Пароль слишком длинный",
      details: { error: "VALIDATION_FAILED", password: "Слишком длинный" },
    }),
  )
  await assert.rejects(mutation.mutationFn({ password: "x" }), (error) => {
    assert.equal(error.code, "VALIDATION_FAILED")
    assert.deepEqual({ ...error.fields }, { password: "Слишком длинный" })
    return true
  })
})
