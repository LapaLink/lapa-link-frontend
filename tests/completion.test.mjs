import { test } from "node:test"
import assert from "node:assert/strict"
import { QueryClient } from "@tanstack/react-query"
import { load, failure, response } from "./otp-loader.mjs"

const tokens = { accessToken: "test-access", refreshToken: "test-refresh" }
const firstId = "2032112f-4957-43d7-99db-4ee94d178eff"
const secondId = "3032112f-4957-43d7-99db-4ee94d178eff"

test("inbox delete one and multiple use the batch contract, de-duplicate ids and reject empty selection locally", async () => {
  const calls = []
  const [{ inboxApi }, auth] = load(["api/inbox.ts", "lib/auth/index.ts"], {
    fetch: async (url, options) => {
      calls.push([
        url,
        options.method,
        options.headers.get("Authorization"),
        options.body,
      ])
      return response(204)
    },
  })
  auth.saveTokens(tokens)
  await inboxApi.delete([firstId])
  await inboxApi.delete([firstId, secondId, firstId])
  await assert.rejects(inboxApi.delete([]), { status: 400 })
  assert.deepEqual(calls, [
    [
      "/api/v1/account/inbox",
      "DELETE",
      "Bearer test-access",
      JSON.stringify({ ids: [firstId] }),
    ],
    [
      "/api/v1/account/inbox",
      "DELETE",
      "Bearer test-access",
      JSON.stringify({ ids: [firstId, secondId] }),
    ],
  ])
})

test("delete retries an expired access token with the same ids through the existing refresh flow", async () => {
  const calls = []
  const [{ inboxApi }, auth] = load(["api/inbox.ts", "lib/auth/index.ts"], {
    fetch: async (url, options) => {
      calls.push([url, options.body])
      if (url.endsWith("/auth/refresh"))
        return response(200, {
          accessToken: "rotated-access",
          refreshToken: "rotated-refresh",
        })
      return options.headers.get("Authorization") === "Bearer test-access"
        ? failure(401, "TOKEN_EXPIRED")
        : response(204)
    },
  })
  auth.saveTokens(tokens)
  await inboxApi.delete([firstId])
  assert.equal(calls.length, 3)
  assert.equal(calls[0][1], calls[2][1])
})

for (const status of [204, 404, 500]) {
  test(`delete ${status}: targeted refetch preserves a simultaneous SSE item and refreshes unread count`, async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    let mutation,
      release,
      unread = 2
    const [
      { useDeleteNotifications },
      auth,
      { prependNotification },
      { inboxApi },
    ] = load(
      [
        "hooks/useInbox.ts",
        "lib/auth/index.ts",
        "lib/inbox/cache.ts",
        "api/inbox.ts",
      ],
      {
        fetch: async (url, options) => {
          if (options.method === "DELETE")
            return new Promise((resolve) => {
              release = () => {
                unread = status === 500 ? 3 : 1
                resolve(
                  status === 204
                    ? response(204)
                    : failure(
                        status,
                        status === 404
                          ? "NOTIFICATION_NOT_FOUND"
                          : "TECHNICAL_ERROR",
                      ),
                )
              }
            })
          return response(200, { count: unread })
        },
        overrides: {
          "@tanstack/react-query": {
            useQueryClient: () => client,
            useMutation: (options) => {
              mutation = options
              return {}
            },
          },
        },
      },
    )
    auth.saveTokens(tokens)
    useDeleteNotifications()
    const key = ["account", "inbox", "list", 0]
    client.setQueryData(key, {
      page: 0,
      size: 10,
      content: [{ id: firstId, read: false }],
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    })
    await client.fetchQuery({
      queryKey: ["account", "inbox", "unread-count"],
      queryFn: () => inboxApi.unreadCount(),
    })
    const pending = mutation.mutationFn([firstId])
    client.setQueryData(key, (page) =>
      prependNotification(page, { id: secondId, read: false }),
    )
    release()
    if (status === 500) await assert.rejects(pending)
    else await pending
    assert.equal(client.getQueryData(key).content[0].id, secondId)
    assert.equal(client.getQueryState(key).isInvalidated, true)
    const count = await client.fetchQuery({
      queryKey: ["account", "inbox", "unread-count"],
      queryFn: () => inboxApi.unreadCount(),
    })
    assert.equal(count.count, status === 500 ? 3 : 1)
    client.clear()
  })
}

test("moderation endpoints use complaint-scoped targets, explicit decisions, comment and sanction reason", async () => {
  const calls = []
  const [{ moderationApi }, auth] = load(
    ["api/moderation.ts", "lib/auth/index.ts"],
    {
      fetch: async (url, options) => {
        calls.push([url, options.method ?? "GET", options.body])
        return response(200, {})
      },
    },
  )
  auth.saveTokens(tokens)
  await moderationApi.list({
    page: 2,
    status: "NEW",
    targetType: "CONVERSATION",
  })
  await moderationApi.target(firstId)
  await moderationApi.act(firstId, "take")
  await moderationApi.act(firstId, "reject", "Не подтвердилось")
  await moderationApi.act(firstId, "hide-target", "Нарушение")
  await moderationApi.blockUser(secondId, "Повторное нарушение")
  assert.deepEqual(calls, [
    [
      "/api/v1/admin/complaints?page=2&size=20&status=NEW&targetType=CONVERSATION",
      "GET",
      undefined,
    ],
    [`/api/v1/admin/complaints/${firstId}/target`, "GET", undefined],
    [`/api/v1/admin/complaints/${firstId}/take`, "POST", undefined],
    [
      `/api/v1/admin/complaints/${firstId}/reject`,
      "POST",
      JSON.stringify({ comment: "Не подтвердилось" }),
    ],
    [
      `/api/v1/admin/complaints/${firstId}/hide-target`,
      "POST",
      JSON.stringify({ comment: "Нарушение" }),
    ],
    [
      `/api/v1/admin/users/${secondId}/block`,
      "POST",
      JSON.stringify({ reason: "Повторное нарушение" }),
    ],
  ])
  assert.ok(calls.every(([url]) => !url.startsWith("/api/v1/chat")))
})

test("moderation guard and decision validation follow supported roles and comment limits", () => {
  const { canModerate, moderationDecisionSchema } = load(
    "lib/moderation/index.ts",
  )
  assert.equal(canModerate(null), false)
  assert.equal(canModerate({ roles: ["USER"] }), false)
  assert.equal(canModerate({ roles: ["MODERATOR"] }), true)
  assert.equal(canModerate({ roles: ["ADMIN"] }), true)
  assert.equal(
    moderationDecisionSchema.safeParse({ comment: " " }).success,
    false,
  )
  assert.equal(
    moderationDecisionSchema.safeParse({ comment: "x".repeat(501) }).success,
    false,
  )
})

test("multi-type feed filters keep priority, city, closed need status, radius and ordering for matching too", async () => {
  const calls = []
  const [
    { parseFeedState, toFeedFilter, feedQueryString },
    { casesApi },
    auth,
  ] = load(["lib/cases/feed.ts", "api/cases.ts", "lib/auth/index.ts"], {
    fetch: async (url) => {
      calls.push(url)
      return response(200, { content: [] })
    },
  })
  auth.saveTokens(tokens)
  const state = parseFeedState(
    new URLSearchParams(
      "needType=FOOD&needType=TRANSPORT&priority=HIGH&cityCode=minsk&needStatus=CLOSED&latitude=53.9&longitude=27.56&radiusKm=15&orderBy=DISTANCE&search=кот",
    ),
  )
  const filter = toFeedFilter(state, 6)
  await casesApi.list(filter)
  await casesApi.matching(filter)
  for (const url of calls) {
    const query = new URL(url, "https://example.test").searchParams
    assert.deepEqual(query.getAll("needType"), ["FOOD", "TRANSPORT"])
    for (const [key, value] of Object.entries({
      priority: "HIGH",
      cityCode: "minsk",
      needStatus: "CLOSED",
      radiusKm: "15",
      orderBy: "DISTANCE",
      search: "кот",
    }))
      assert.equal(query.get(key), value)
  }
  const defaults = parseFeedState(new URLSearchParams())
  assert.equal(toFeedFilter(defaults, 6).needStatus, undefined)
  assert.equal(feedQueryString(defaults), "")
})

test("wizard maps field errors to their step and synchronously prevents duplicate creation", async () => {
  const [{ firstInvalidStep }, { useCreateCase }, auth] = load(
    [
      "components/pages/CreateCase/steps.ts",
      "components/pages/CreateCase/hooks/useCreateCase.ts",
      "lib/auth/index.ts",
    ],
    {
      overrides: {
        react: {
          useRef: (value) => ({ current: value }),
          useState: (value) => [value, () => {}],
        },
        "react-hook-form": {
          useForm: () => ({
            reset() {},
            clearErrors() {},
            setError() {},
            formState: {},
          }),
        },
        "@/hooks": { dictionaryQueries: {} },
        "@tanstack/react-query": {
          useQueryClient: () => ({ invalidateQueries: async () => {} }),
          useMutation: (options) => ({
            isPending: false,
            mutateAsync: options.mutationFn,
            reset() {},
          }),
        },
      },
      fetch: async () => {
        requests++
        return new Promise((resolve) => {
          finish = () => resolve(response(200, { id: firstId, status: "OPEN" }))
        })
      },
    },
  )
  assert.equal(
    firstInvalidStep((field) => field === "cityCode"),
    3,
  )
  assert.equal(
    firstInvalidStep((field) => field === "photos"),
    2,
  )
  let requests = 0,
    finish
  auth.saveTokens(tokens)
  const publication = useCreateCase()
  const values = {
    animalType: "CAT",
    title: "Кот",
    cityCode: "minsk",
    latitude: "53.9",
    longitude: "27.56",
    needTypes: [],
    photos: [],
  }
  const first = publication.submit(values)
  await publication.submit(values)
  assert.equal(requests, 1)
  finish()
  await first
})

test("case gallery validates 0, 1, 10 and over-limit files", () => {
  const { createCaseSchema } = load("components/pages/CreateCase/schemas.ts")
  const data = {
    animalType: "CAT",
    sex: "UNKNOWN",
    title: "Кот",
    cityCode: "minsk",
    latitude: "53.9",
    longitude: "27.56",
    description: "",
    approximateAge: "",
    condition: "",
    needTypes: [],
  }
  const photo = new File(["photo"], "cat.png", { type: "image/png" })
  for (const size of [0, 1, 3, 10])
    assert.equal(
      createCaseSchema.safeParse({ ...data, photos: Array(size).fill(photo) })
        .success,
      true,
    )
  assert.equal(
    createCaseSchema.safeParse({ ...data, photos: Array(11).fill(photo) })
      .success,
    false,
  )
})

test("concurrent moderation failure refreshes current reports without discarding a different session", async () => {
  let mutation
  const invalidated = []
  const [{ useModerationAction }, auth] = load(
    ["hooks/useModeration.ts", "lib/auth/index.ts"],
    {
      fetch: async () =>
        failure(409, "COMPLAINT_ALREADY_PROCESSED", "Жалоба уже рассмотрена"),
      overrides: {
        "@tanstack/react-query": {
          useQueryClient: () => ({
            invalidateQueries: async ({ queryKey }) =>
              invalidated.push(queryKey),
          }),
          useMutation: (options) => {
            mutation = options
            return {}
          },
        },
      },
    },
  )
  auth.saveTokens(tokens)
  useModerationAction(firstId, { targetType: "CASE", targetId: secondId })
  await assert.rejects(mutation.mutationFn({ action: "take" }), { status: 409 })
  assert.ok(invalidated.some((key) => key[0] === "moderation"))
  assert.ok(invalidated.some((key) => key[0] === "cases" && key[1] === "detail" && key[2] === secondId))
  assert.ok(invalidated.every((key) => key.length > 0))
})
