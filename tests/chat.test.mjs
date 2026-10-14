import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
function load(file, mocks = {}, globals = {}) {
  const exports = {}
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  vm.runInNewContext(`(function(exports, require) { ${compiled}\n})`, {
    setTimeout,
    clearTimeout,
    Date,
    ...globals,
  })(exports, (name) => mocks[name] ?? require(name))
  return exports
}

const events = load("lib/chat/events.ts")
const history = load("lib/chat/messages.ts")
const session = load("lib/chat/session.ts")
const conversations = load("lib/chat/conversations.ts")
const state = load("lib/chat/state.ts", {
  "@/lib/constants": load("lib/constants/routes.ts"),
})

const conversationId = "6f1c1d3e-2b7a-4c1e-9a55-0d2b7c1e4a10"
const userId = "0b8f6a52-1d2c-4e7f-8a9b-3c4d5e6f7a8b"
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`
const message = (n, extra = {}) => ({
  id: uuid(n),
  conversationId,
  senderId: userId,
  clientMessageId: uuid(1000 + n),
  text: `Сообщение ${n}`,
  createdAt: new Date(Date.UTC(2026, 9, 14, 10, n)).toISOString(),
  ...extra,
})
// Objects created inside the vm context have foreign prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value))
const historyData = (...pages) => ({
  pages: pages.map((messages) => ({ messages })),
  pageParams: pages.map(() => undefined),
})

test("chat event schemas accept valid frames and drop garbage", () => {
  assert.deepEqual(
    plain(events.parseFrame(events.chatMessageSchema, JSON.stringify(message(1)))),
    message(1),
  )
  const chatError = {
    conversationId,
    clientMessageId: uuid(1001),
    error: "CHAT_NOT_WRITABLE",
    message: "В этот диалог сейчас нельзя писать.",
  }
  assert.deepEqual(
    plain(events.parseFrame(events.chatErrorSchema, JSON.stringify(chatError))),
    chatError,
  )
  assert.deepEqual(
    plain(
      events.parseFrame(
        events.chatErrorSchema,
        JSON.stringify({ ...chatError, clientMessageId: null }),
      ),
    ),
    { ...chatError, clientMessageId: null },
  )
  for (const bad of [
    { ...chatError, message: undefined },
    { ...chatError, clientMessageId: "1" },
  ])
    assert.equal(
      events.parseFrame(events.chatErrorSchema, JSON.stringify(bad)),
      null,
    )
  for (const body of [
    "not json",
    "null",
    JSON.stringify({ ...message(1), id: "1" }),
    JSON.stringify({ ...message(1), text: "" }),
    JSON.stringify({ ...message(1), text: "я".repeat(2001) }),
    JSON.stringify({ ...message(1), senderId: undefined }),
  ])
    assert.equal(events.parseFrame(events.chatMessageSchema, body), null)
  assert.equal(
    events.parseFrame(events.chatErrorSchema, JSON.stringify({ error: 1 })),
    null,
  )
})

const conversation = (n, extra = {}) => ({
  id: uuid(n),
  targetType: "CASE",
  targetId: uuid(500),
  targetTitle: "Найден рыжий кот",
  status: "ACTIVE",
  participants: [
    { userId, displayName: "Автор", role: "OWNER" },
    { userId: uuid(600), displayName: "Помощник", role: "INITIATOR" },
  ],
  writable: true,
  unreadCount: 0,
  lastMessageAt: null,
  createdAt: new Date(Date.UTC(2026, 9, 1, n)).toISOString(),
  ...extra,
})

test("conversation and unread-count pushes are validated", () => {
  assert.deepEqual(
    plain(
      events.parseFrame(
        events.conversationSchema,
        JSON.stringify(conversation(1)),
      ),
    ),
    conversation(1),
  )
  for (const bad of [
    { ...conversation(1), id: "1" },
    { ...conversation(1), status: "CLOSED" },
    { ...conversation(1), unreadCount: -1 },
    { ...conversation(1), writable: undefined },
  ])
    assert.equal(
      events.parseFrame(events.conversationSchema, JSON.stringify(bad)),
      null,
    )
  assert.equal(
    events.parseFrame(events.unreadCountSchema, '{"count":3}').count,
    3,
  )
  assert.equal(events.parseFrame(events.unreadCountSchema, '{"count":-1}'), null)
})

test("pushed conversation replaces its row and keeps the page sorted by activity", () => {
  const page = {
    content: [
      conversation(3, { lastMessageAt: "2026-10-14T12:00:00.000Z" }),
      conversation(2, { lastMessageAt: "2026-10-14T11:00:00.000Z" }),
      conversation(1),
    ],
    page: 0,
    size: 20,
    totalElements: 3,
    totalPages: 1,
    first: true,
    last: true,
  }
  const pushed = conversation(1, {
    lastMessageAt: "2026-10-14T13:00:00.000Z",
    unreadCount: 2,
    writable: false,
  })
  const merged = conversations.mergeConversation(page, pushed)
  assert.deepEqual(
    merged.content.map((item) => item.id),
    [uuid(1), uuid(3), uuid(2)],
  )
  assert.equal(merged.content[0], pushed)
  assert.equal(merged.totalElements, 3)
  assert.equal(conversations.mergeConversation(page, conversation(9)), page)
  assert.equal(conversations.mergeConversation(undefined, pushed), undefined)
})

test("ERROR frames reconnect after a token change and end only a stale session", () => {
  const { resolveStompError } = session
  assert.equal(resolveStompError("TOKEN_EXPIRED", "a", "a"), "refresh")
  assert.equal(resolveStompError("TOKEN_EXPIRED", "a", "b"), "reconnect")
  assert.equal(resolveStompError("TOKEN_EXPIRED", "a", null), "logout")
  assert.equal(resolveStompError("SESSION_NOT_FOUND", "a", "b"), "reconnect")
  assert.equal(resolveStompError("SESSION_NOT_FOUND", "a", "a"), "logout")
  assert.equal(resolveStompError("SESSION_NOT_FOUND", "a", null), "logout")
  assert.equal(resolveStompError("TOKEN_INVALID", "a", "a"), "logout")
  assert.equal(resolveStompError("TOKEN_INVALID", "a", "b"), "reconnect")
  assert.equal(resolveStompError("USER_BLOCKED", "a", "a"), "stop")
  assert.equal(resolveStompError("ACCESS_DENIED", "a", "a"), "stop")
  assert.equal(resolveStompError("", "a", "a"), "reconnect")
})

test("missed messages load after the last confirmed id until a short page", async () => {
  const optimistic = { ...message(9), id: uuid(1009), status: "sending" }
  assert.equal(
    history.lastConfirmedId(historyData([optimistic, message(5)], [message(4)])),
    uuid(5),
  )
  assert.equal(history.lastConfirmedId(historyData([optimistic])), undefined)

  const calls = []
  const pages = [[message(6), message(7)], [message(8), message(9)], [message(10)]]
  const loaded = await history.loadMessagesAfter(
    async (after) => {
      calls.push(after)
      return pages.shift() ?? []
    },
    uuid(5),
    2,
  )
  assert.deepEqual(calls, [uuid(5), uuid(7), uuid(9)])
  assert.deepEqual(
    plain(loaded.map((item) => item.id)),
    [uuid(6), uuid(7), uuid(8), uuid(9), uuid(10)],
  )
  let requests = 0
  await history.loadMessagesAfter(
    async () => {
      requests++
      return [message(1), message(2)]
    },
    uuid(0),
    2,
    3,
  )
  assert.equal(requests, 3)
})

test("a send rejection fails only the named message, or all pending ones when unknown", () => {
  const other = "11111111-1111-4111-8111-111111111111"
  const pending = new Map([
    [uuid(1), { conversationId }],
    [uuid(2), { conversationId }],
    [uuid(3), { conversationId: other }],
  ])
  assert.deepEqual(
    plain(history.rejectedMessageIds(pending, { conversationId, clientMessageId: uuid(2) })),
    [uuid(2)],
  )
  assert.deepEqual(
    plain(history.rejectedMessageIds(pending, { conversationId, clientMessageId: null })),
    [uuid(1), uuid(2)],
  )
  assert.deepEqual(
    plain(history.rejectedMessageIds(pending, { conversationId, clientMessageId: uuid(9) })),
    [],
  )
})

test("history cursor is the oldest id of a full page and ends on a short page", () => {
  const full = Array.from({ length: 3 }, (_, i) => message(3 - i))
  assert.equal(history.toHistoryPage(full, 3).nextCursor, uuid(1))
  assert.equal(history.toHistoryPage(full.slice(0, 2), 3).nextCursor, undefined)
  assert.equal(history.toHistoryPage([], 3).nextCursor, undefined)
})

test("history merge dedupes by id, confirms optimistic messages and orders by time", () => {
  const optimistic = {
    ...message(9),
    id: uuid(1009),
    status: "sending",
  }
  let data = historyData([message(5), message(4)], [message(3), message(2)])
  data = history.mergeMessage(data, optimistic)
  assert.equal(data.pages[0].messages[0], optimistic)

  const echo = message(9)
  data = history.mergeMessage(data, echo)
  const feed = history.flattenHistory(data)
  assert.deepEqual(
    plain(feed.map((item) => item.id)),
    [uuid(2), uuid(3), uuid(4), uuid(5), uuid(9)],
  )
  assert.equal(feed.at(-1).status, undefined)

  assert.equal(history.mergeMessage(data, message(9)), data)
  assert.equal(history.mergeMessage(data, message(4)), data)
  assert.equal(history.mergeMessage(undefined, message(1)), undefined)

  // A late echo still confirms a message that was already marked failed.
  let failed = history.mergeMessage(historyData([]), { ...optimistic })
  failed = history.setMessageStatus(failed, new Set([optimistic.clientMessageId]), "failed")
  assert.equal(history.flattenHistory(failed)[0].status, "failed")
  failed = history.mergeMessage(failed, echo)
  assert.deepEqual(plain(history.flattenHistory(failed)), [echo])
})

test("setMessageStatus only touches unconfirmed messages", () => {
  const sent = message(1)
  const pending = { ...message(2), id: uuid(1002), status: "sending" }
  const data = history.setMessageStatus(
    historyData([pending, sent]),
    new Set([sent.clientMessageId, pending.clientMessageId]),
    "failed",
  )
  assert.equal(data.pages[0].messages[0].status, "failed")
  assert.equal(data.pages[0].messages[1], sent)
})

test("chat error codes map to user-facing texts", () => {
  const { ApiError, getErrorMessage } = load("api/instance.ts", {
    "@/lib/auth": {
      getSessionRevision: () => 0,
      readTokens: () => null,
      saveTokens() {},
    },
  })
  const expected = {
    CHAT_DISABLED: "Автор выключил чат для этого объявления.",
    CHAT_NOT_ALLOWED: "Чат доступен только пользователям с активным откликом.",
    CHAT_REQUEST_DECLINED: "Автор отклонил запрос на чат.",
    CONVERSATION_NOT_REQUESTED: "Запрос уже рассмотрен. Список обновлён.",
    CONVERSATION_NOT_FOUND: "Диалог не найден.",
    NOT_CHAT_OWNER: "Управлять чатом может только автор объявления.",
    CHAT_NOT_WRITABLE: "В этот диалог сейчас нельзя писать.",
    CASE_CLOSED: "Объявление закрыто.",
  }
  for (const [code, text] of Object.entries(expected))
    assert.equal(getErrorMessage(new ApiError("", 409, code), "Ошибка"), text)

  const { chatErrorMessage } = load("lib/chat/errors.ts", {
    "@/api": { ApiError, getErrorMessage },
  })
  assert.match(
    chatErrorMessage(new ApiError("", 409, "OPERATION_IN_PROGRESS"), "Ошибка"),
    /Запрос уже обрабатывается/,
  )
  assert.equal(
    chatErrorMessage(new ApiError("", 409, "CHAT_DISABLED"), "Ошибка"),
    expected.CHAT_DISABLED,
  )
})

test("case page picks the chat control from the permission response", () => {
  const pick = (permission, extra = {}) =>
    state.caseChatAction({
      isAuthor: false,
      hasActiveResponse: true,
      permission: {
        enabled: true,
        canRequest: false,
        conversationStatus: null,
        ...permission,
      },
      ...extra,
    })
  assert.equal(pick({ canRequest: true }, { isAuthor: true }), "hidden")
  assert.equal(
    state.caseChatAction({
      isAuthor: false,
      hasActiveResponse: true,
      permission: undefined,
    }),
    "loading",
  )
  assert.equal(pick({ canRequest: true }), "request")
  assert.equal(pick({ conversationStatus: "REQUESTED" }), "requested")
  assert.equal(pick({ conversationStatus: "ACTIVE" }), "open")
  assert.equal(
    pick({ enabled: false, conversationStatus: "ACTIVE" }),
    "open",
  )
  assert.equal(pick({ conversationStatus: "DECLINED" }), "declined")
  assert.equal(pick({ enabled: false }), "disabled")
  // Without an own response the "chat is off" hint is not shown.
  assert.equal(pick({ enabled: false }, { hasActiveResponse: false }), "hidden")
  // Chat on but not eligible (no response, case closed): nothing to offer.
  assert.equal(pick({}), "hidden")
})

test("conversation helpers find participants and the target link", () => {
  const conversation = {
    targetType: "CASE",
    targetId: "case-1",
    participants: [
      { userId: "owner", displayName: "Автор", role: "OWNER" },
      { userId: "helper", displayName: "Помощник", role: "INITIATOR" },
    ],
  }
  assert.equal(state.counterpart(conversation, "owner").displayName, "Помощник")
  assert.equal(state.counterpart(conversation, "helper").displayName, "Автор")
  assert.equal(state.initiator(conversation).userId, "helper")
  assert.equal(state.isConversationOwner(conversation, "owner"), true)
  assert.equal(state.isConversationOwner(conversation, "helper"), false)
  assert.equal(state.conversationTargetHref(conversation), "/cases/case-1")
})

function socketHarness({ refresh } = {}) {
  const clients = []
  const calls = { refresh: [], saved: [], closed: [] }
  const stored = { tokens: { accessToken: "access-1", refreshToken: "refresh-1" } }
  class ApiError extends Error {
    constructor(message, status) {
      super(message)
      this.status = status
    }
  }
  class Client {
    constructor(config) {
      Object.assign(this, config)
      this.connected = false
      this.subscriptions = {}
      this.published = []
      this.deactivated = false
      clients.push(this)
    }
    activate() {
      this.activated = true
    }
    deactivate() {
      this.deactivated = true
      return Promise.resolve()
    }
    subscribe(destination, callback) {
      this.subscriptions[destination] = callback
    }
    publish(frame) {
      this.published.push(frame)
    }
  }
  const { startChatSocket } = load(
    "hooks/model/chatSocket.ts",
    {
      "@stomp/stompjs": { Client, ReconnectionTimeMode: { EXPONENTIAL: 1 } },
      "@/api": {
        ApiError,
        getPreferredLocale: () => "be",
        waitForRefresh: async () => {},
        refreshTokens: async (stale) => {
          calls.refresh.push(stale)
          if (refresh) return refresh(stale)
          stored.tokens = { accessToken: "access-2", refreshToken: "refresh-2" }
          return stored.tokens
        },
      },
      "@/lib/auth": {
        readTokens: () => stored.tokens,
        saveTokens: (value) => {
          calls.saved.push(value)
          stored.tokens = value
        },
      },
      "@/lib/chat": { ...events, ...session },
    },
    { window: { location: { protocol: "https:", host: "lapa.test" } } },
  )
  const received = {
    messages: [],
    errors: [],
    statuses: [],
    conversations: [],
    counts: [],
  }
  const socket = startChatSocket({
    isCurrent: () => true,
    onMessage: (value) => received.messages.push(value),
    onError: (value) => received.errors.push(value),
    onConversation: (value) => received.conversations.push(value),
    onUnreadCount: (value) => received.counts.push(value),
    onStatus: (value) => received.statuses.push(value),
    onClosed: (value) => calls.closed.push(value),
  })
  return { client: clients[0], socket, received, calls, stored, ApiError }
}

test("chat socket authenticates, routes all four queues and sends only while connected", async () => {
  const { client, socket, received } = socketHarness()
  assert.equal(client.brokerURL, "wss://lapa.test/ws")
  assert.equal(client.heartbeatIncoming, 10_000)
  assert.equal(client.heartbeatOutgoing, 10_000)
  assert.ok(client.reconnectDelay > 0)
  assert.equal(client.activated, true)
  assert.equal(socket.send(conversationId, { clientMessageId: uuid(1), text: "a" }), false)

  await client.beforeConnect()
  assert.deepEqual(plain(client.connectHeaders), {
    Authorization: "Bearer access-1",
    "Accept-Language": "be",
  })
  client.connected = true
  client.onConnect()
  assert.deepEqual(Object.keys(client.subscriptions).sort(), [
    "/user/queue/conversations",
    "/user/queue/errors",
    "/user/queue/messages",
    "/user/queue/unread-count",
  ])
  const deliver = client.subscriptions["/user/queue/messages"]
  deliver({ body: JSON.stringify(message(1)) })
  deliver({ body: JSON.stringify(message(1)) })
  deliver({ body: "{bad" })
  const chatError = {
    conversationId,
    clientMessageId: uuid(1001),
    error: "CHAT_NOT_WRITABLE",
    message: "Нельзя писать",
  }
  client.subscriptions["/user/queue/errors"]({ body: JSON.stringify(chatError) })
  client.subscriptions["/user/queue/conversations"]({
    body: JSON.stringify(conversation(1)),
  })
  client.subscriptions["/user/queue/conversations"]({ body: "{}" })
  client.subscriptions["/user/queue/unread-count"]({ body: '{"count":4}' })
  assert.equal(received.messages.length, 1)
  assert.deepEqual(plain(received.errors), [chatError])
  assert.equal(received.conversations.length, 1)
  assert.deepEqual(received.counts, [4])
  assert.deepEqual(received.statuses, ["connecting", "connected"])

  assert.equal(socket.send(conversationId, { clientMessageId: uuid(1), text: "Привет" }), true)
  assert.equal(
    client.published[0].destination,
    `/app/conversations/${conversationId}/messages`,
  )
  assert.deepEqual(JSON.parse(client.published[0].body), {
    clientMessageId: uuid(1),
    text: "Привет",
  })
  socket.stop()
  assert.equal(client.deactivated, true)
})

test("chat socket refreshes a token that expires mid-connection and reconnects", async () => {
  const { client, calls } = socketHarness()
  await client.beforeConnect()
  client.connected = true
  client.onConnect()
  client.onStompError({ headers: { message: "TOKEN_EXPIRED" }, body: "Истёк" })
  client.onWebSocketClose()
  await client.beforeConnect()
  assert.equal(client.deactivated, false)
  assert.deepEqual(plain(calls.refresh), [
    { accessToken: "access-1", refreshToken: "refresh-1" },
  ])
  assert.deepEqual(plain(client.connectHeaders).Authorization, "Bearer access-2")
})

test("SESSION_NOT_FOUND after a refresh reconnects with the new token", async () => {
  const { client, calls, stored } = socketHarness()
  await client.beforeConnect()
  // The REST layer of this tab (or another tab) rotated the token.
  stored.tokens = { accessToken: "access-2", refreshToken: "refresh-2" }
  client.onStompError({ headers: { message: "SESSION_NOT_FOUND" }, body: "" })
  client.onWebSocketClose()
  await client.beforeConnect()
  assert.equal(client.deactivated, false)
  assert.deepEqual(calls.saved, [])
  assert.deepEqual(calls.refresh, [])
  assert.equal(plain(client.connectHeaders).Authorization, "Bearer access-2")
})

test("chat socket ends a stale session, stops for blocked users and on rejected refresh", async () => {
  const ended = socketHarness()
  await ended.client.beforeConnect()
  ended.client.onStompError({ headers: { message: "SESSION_NOT_FOUND" }, body: "" })
  await ended.client.beforeConnect()
  assert.deepEqual(ended.calls.saved, [null])
  assert.equal(ended.client.deactivated, true)

  const blocked = socketHarness()
  await blocked.client.beforeConnect()
  blocked.client.onStompError({
    headers: { message: "USER_BLOCKED" },
    body: "Аккаунт заблокирован.",
  })
  await blocked.client.beforeConnect()
  assert.deepEqual(blocked.calls.saved, [])
  assert.equal(blocked.client.deactivated, true)
  assert.deepEqual(plain(blocked.calls.closed), [
    { code: "USER_BLOCKED", message: "Аккаунт заблокирован." },
  ])

  let harness
  harness = socketHarness({
    refresh: () => {
      throw new harness.ApiError("Сессия завершена", 401)
    },
  })
  await harness.client.beforeConnect()
  harness.client.onStompError({ headers: { message: "TOKEN_EXPIRED" }, body: "" })
  await harness.client.beforeConnect()
  assert.equal(harness.client.deactivated, true)
})
