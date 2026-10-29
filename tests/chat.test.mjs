import { mock, test } from "node:test"
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
// Timers resolved per call, so node:test mock timers apply inside the vm context.
const typingStore = load("lib/chat/typing.ts", {}, {
  setTimeout: (...args) => globalThis.setTimeout(...args),
  clearTimeout: (timer) => globalThis.clearTimeout(timer),
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
  editedAt: null,
  deletedAt: null,
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
    { userId, displayName: "Автор", role: "OWNER", lastReadAt: null },
    {
      userId: uuid(600),
      displayName: "Помощник",
      role: "INITIATOR",
      lastReadAt: null,
    },
  ],
  writable: true,
  unreadCount: 0,
  lastMessageAt: null,
  createdAt: new Date(Date.UTC(2026, 9, 1, n)).toISOString(),
  closedAt: null,
  closedBy: null,
  hidden: false,
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
    { ...conversation(1), status: "ARCHIVED" },
    { ...conversation(1), hidden: undefined },
    { ...conversation(1), closedBy: "1" },
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

test("pushes without null fields (backend omits nulls) parse with nulls filled in", () => {
  const omitNulls = (value) =>
    JSON.stringify(value, (_, field) => (field === null ? undefined : field))
  assert.deepEqual(
    plain(events.parseFrame(events.chatMessageSchema, omitNulls(message(1)))),
    message(1),
  )
  const deleted = message(2, { text: null, deletedAt: message(2).createdAt })
  assert.deepEqual(
    plain(events.parseFrame(events.chatMessageSchema, omitNulls(deleted))),
    deleted,
  )
  assert.deepEqual(
    plain(
      events.parseFrame(events.conversationSchema, omitNulls(conversation(1))),
    ),
    conversation(1),
  )
  const chatError = {
    conversationId,
    clientMessageId: null,
    error: "CHAT_NOT_WRITABLE",
    message: "В этот диалог сейчас нельзя писать.",
  }
  assert.deepEqual(
    plain(events.parseFrame(events.chatErrorSchema, omitNulls(chatError))),
    chatError,
  )
})

test("deleted messages, CLOSED conversations and typing events pass validation", () => {
  const deleted = message(1, { text: null, deletedAt: "2026-10-14T11:00:00.123456Z" })
  assert.deepEqual(
    plain(events.parseFrame(events.chatMessageSchema, JSON.stringify(deleted))),
    deleted,
  )
  const edited = message(1, { text: "Исправлено", editedAt: "2026-10-14T11:00:00Z" })
  assert.deepEqual(
    plain(events.parseFrame(events.chatMessageSchema, JSON.stringify(edited))),
    edited,
  )
  const closed = conversation(1, {
    status: "CLOSED",
    writable: false,
    closedAt: "2026-10-14T12:00:00.000001Z",
    closedBy: userId,
    hidden: true,
    participants: [
      { userId, displayName: "Автор", role: "OWNER", lastReadAt: "2026-10-14T11:00:00Z" },
      { userId: uuid(600), displayName: "Помощник", role: "INITIATOR", lastReadAt: null },
    ],
  })
  assert.deepEqual(
    plain(events.parseFrame(events.conversationSchema, JSON.stringify(closed))),
    closed,
  )
  const typing = { conversationId, userId, typing: true }
  assert.deepEqual(
    plain(events.parseFrame(events.chatTypingSchema, JSON.stringify(typing))),
    typing,
  )
  assert.equal(
    events.parseFrame(events.chatTypingSchema, JSON.stringify({ ...typing, typing: "yes" })),
    null,
  )
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

test("a conversation that no longer matches the list's hidden filter is removed", () => {
  const page = {
    content: [conversation(2), conversation(1)],
    page: 0,
    size: 20,
    totalElements: 2,
    totalPages: 1,
    first: true,
    last: true,
  }
  const hidden = conversation(1, { hidden: true })
  const visible = conversations.mergeConversation(page, hidden, false)
  assert.deepEqual(visible.content.map((item) => item.id), [uuid(2)])
  assert.equal(visible.totalElements, 1)
  // Matching or unfiltered lists still replace it in place.
  assert.equal(conversations.mergeConversation(page, hidden, undefined).content[1], hidden)
  const shown = conversation(1, { unreadCount: 1 })
  assert.equal(conversations.mergeConversation(page, shown, false).content[1], shown)
  // Not on the page: nothing changes, the caller decides whether to refetch.
  assert.equal(conversations.mergeConversation(page, conversation(9, { hidden: true }), false), page)
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

test("edits and deletions replace a delivered message by id, stale versions are ignored", () => {
  const original = message(5)
  let data = historyData([message(6), original], [message(4)])

  const edited = message(5, { text: "Исправлено", editedAt: "2026-10-14T11:00:00.000Z" })
  data = history.mergeMessage(data, edited)
  assert.equal(data.pages[0].messages[1], edited)
  assert.equal(data.pages[0].messages.length, 2)
  assert.equal(history.mergeMessage(data, edited), data)
  assert.equal(history.mergeMessage(data, original), data)
  const older = message(5, { text: "Раньше", editedAt: "2026-10-14T10:59:00.000Z" })
  assert.equal(history.mergeMessage(data, older), data)

  const newer = message(5, { text: "Ещё раз", editedAt: "2026-10-14T11:01:00.000Z" })
  data = history.mergeMessage(data, newer)
  assert.equal(data.pages[0].messages[1], newer)

  const deleted = message(5, {
    text: null,
    editedAt: newer.editedAt,
    deletedAt: "2026-10-14T11:02:00.000Z",
  })
  data = history.mergeMessage(data, deleted)
  const feed = history.flattenHistory(data)
  assert.deepEqual(plain(feed.map((item) => item.id)), [uuid(4), uuid(5), uuid(6)])
  assert.equal(feed[1], deleted)
  // A late edit cannot bring a deleted message back.
  const late = message(5, { text: "Поздно", editedAt: "2026-10-14T11:03:00.000Z" })
  assert.equal(history.mergeMessage(data, late), data)
  assert.equal(history.mergeMessage(data, { ...deleted, deletedAt: "2026-10-14T11:04:00.000Z" }), data)
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
  // A closed conversation opens its read-only history; the server no longer offers a request.
  assert.equal(pick({ conversationStatus: "CLOSED" }), "open")
  assert.equal(pick({ enabled: false, conversationStatus: "CLOSED" }), "open")
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

test("a message is read once the participant's lastReadAt reaches its createdAt", () => {
  const sent = { createdAt: "2026-10-14T10:00:00.123456Z" }
  assert.equal(state.isReadBy(sent, { lastReadAt: "2026-10-14T10:00:00.123456Z" }), true)
  assert.equal(state.isReadBy(sent, { lastReadAt: "2026-10-14T10:00:01Z" }), true)
  assert.equal(state.isReadBy(sent, { lastReadAt: "2026-10-14T09:59:59Z" }), false)
  assert.equal(state.isReadBy(sent, { lastReadAt: null }), false)
  assert.equal(state.isReadBy(sent, undefined), false)
  // Compared as times, not strings: "+03:00" is earlier here than it reads.
  assert.equal(state.isReadBy(sent, { lastReadAt: "2026-10-14T12:00:00+03:00" }), false)
})

test("a closed conversation is deleted 14 days after closedAt", () => {
  assert.equal(
    state
      .conversationDeletionDate({ status: "CLOSED", closedAt: "2026-10-01T08:30:00Z" })
      .toISOString(),
    "2026-10-15T08:30:00.000Z",
  )
  assert.equal(
    state.conversationDeletionDate({ status: "ACTIVE", closedAt: null }),
    null,
  )
  assert.equal(state.conversationStatusLabels.CLOSED, "Диалог закрыт")
})

test("typing indicator expires by itself and clears on typing: false", () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  try {
    const store = typingStore.createTypingStore()
    let notified = 0
    store.subscribe(() => notified++)
    const empty = store.get(conversationId)
    assert.equal(store.get(conversationId), empty)

    store.set(conversationId, userId, true)
    const typing = store.get(conversationId)
    assert.deepEqual(plain(typing), [userId])
    assert.equal(store.get(conversationId), typing)
    mock.timers.tick(5000)
    // A repeated event extends the entry without a new snapshot.
    store.set(conversationId, userId, true)
    assert.equal(store.get(conversationId), typing)
    mock.timers.tick(5999)
    assert.deepEqual(plain(store.get(conversationId)), [userId])
    mock.timers.tick(1)
    assert.deepEqual(plain(store.get(conversationId)), [])
    assert.equal(notified, 2)

    store.set(conversationId, userId, true)
    store.set(conversationId, userId, false)
    assert.deepEqual(plain(store.get(conversationId)), [])
    store.set(conversationId, uuid(600), false)
    assert.equal(notified, 4)
  } finally {
    mock.timers.reset()
  }
})

function socketHarness({ refresh, socketUrl } = {}) {
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
      "@/lib/config/chat": { getConfiguredChatSocketUrl: () => socketUrl },
    },
    { window: { location: { protocol: "https:", host: "lapa.test" } } },
  )
  const received = {
    messages: [],
    errors: [],
    statuses: [],
    conversations: [],
    typing: [],
    counts: [],
  }
  const socket = startChatSocket({
    isCurrent: () => true,
    onMessage: (value) => received.messages.push(value),
    onError: (value) => received.errors.push(value),
    onConversation: (value) => received.conversations.push(value),
    onTyping: (value) => received.typing.push(value),
    onUnreadCount: (value) => received.counts.push(value),
    onStatus: (value) => received.statuses.push(value),
    onClosed: (value) => calls.closed.push(value),
  })
  return { client: clients[0], socket, received, calls, stored, ApiError }
}

test("chat socket authenticates, routes all five queues and sends only while connected", async () => {
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
    "/user/queue/typing",
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
  const typing = { conversationId, userId: uuid(600), typing: true }
  client.subscriptions["/user/queue/typing"]({ body: JSON.stringify(typing) })
  client.subscriptions["/user/queue/typing"]({ body: "{}" })
  assert.deepEqual(plain(received.typing), [typing])
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
  assert.equal(socket.sendTyping(conversationId, true), true)
  assert.equal(
    client.published[1].destination,
    `/app/conversations/${conversationId}/typing`,
  )
  assert.deepEqual(JSON.parse(client.published[1].body), { typing: true })
  assert.equal(client.published[1].headers["content-type"], "application/json")
  client.connected = false
  assert.equal(socket.sendTyping(conversationId, false), false)
  assert.equal(client.published.length, 2)
  socket.stop()
  assert.equal(client.deactivated, true)
})

test("chat socket passes edits and deletions with a known id and drops exact repeats", async () => {
  const { client, received } = socketHarness()
  await client.beforeConnect()
  client.connected = true
  client.onConnect()
  const deliver = (value) =>
    client.subscriptions["/user/queue/messages"]({ body: JSON.stringify(value) })
  const edited = message(1, { text: "Исправлено", editedAt: "2026-10-14T11:00:00Z" })
  const deleted = message(1, {
    text: null,
    editedAt: edited.editedAt,
    deletedAt: "2026-10-14T11:01:00Z",
  })
  deliver(message(1))
  deliver(edited)
  deliver(edited)
  deliver(deleted)
  deliver(deleted)
  assert.deepEqual(plain(received.messages), [message(1), edited, deleted])
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

test("chat socket URL comes from NEXT_PUBLIC_CHAT_WS_URL or falls back to same-origin /ws", () => {
  const config = (value) =>
    load("lib/config/chat.ts", {}, {
      process: { env: { NEXT_PUBLIC_CHAT_WS_URL: value } },
      URL,
    }).getConfiguredChatSocketUrl
  assert.equal(config(undefined)(), undefined)
  assert.equal(config("")(), undefined)
  assert.equal(config("wss://api.lapa.test/ws")(), "wss://api.lapa.test/ws")
  assert.equal(config("ws://localhost:8080/ws")(), "ws://localhost:8080/ws")
  for (const bad of [
    "https://api.lapa.test/ws",
    "wss://user:pass@api.lapa.test/ws",
    "wss://api.lapa.test/ws?token=1",
    "wss://api.lapa.test/ws#x",
    "not a url",
  ])
    assert.throws(() => config(bad)(), /NEXT_PUBLIC_CHAT_WS_URL/, bad)

  assert.equal(
    socketHarness({ socketUrl: "wss://api.lapa.test/ws" }).client.brokerURL,
    "wss://api.lapa.test/ws",
  )
  assert.equal(socketHarness().client.brokerURL, "wss://lapa.test/ws")
})

test("a conversation closed by someone outside it is closed by a moderator", () => {
  const participants = [
    { userId, displayName: "Автор", role: "OWNER", lastReadAt: null },
    { userId: uuid(600), displayName: "Помощник", role: "INITIATOR", lastReadAt: null },
  ]
  const closed = (closedBy) =>
    conversation(1, { status: "CLOSED", writable: false, closedAt: "2026-10-14T12:00:00Z", closedBy, participants })
  assert.equal(state.isClosedByModerator(closed(uuid(900))), true)
  // Closed by a participant or automatically: not the moderator.
  assert.equal(state.isClosedByModerator(closed(userId)), false)
  assert.equal(state.isClosedByModerator(closed(null)), false)
  assert.equal(state.isClosedByModerator({ ...closed(uuid(900)), status: "ACTIVE" }), false)
  // The same shape arrives over the socket.
  const pushed = events.parseFrame(events.conversationSchema, JSON.stringify(closed(uuid(900))))
  assert.equal(state.isClosedByModerator(pushed), true)
})
