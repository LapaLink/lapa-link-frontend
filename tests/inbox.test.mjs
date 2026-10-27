import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import { createRequire } from "node:module"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const exports = {}
  const compiled = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  vm.runInNewContext(`(function(exports, require) { ${compiled}\n})`, {
    TextDecoder,
    AbortController,
    AbortSignal,
    setTimeout,
    clearTimeout,
    Date,
    Intl,
  })(exports, (name) => mocks[name] ?? require(name))
  return exports
}
const events = load("lib/inbox/events.ts")
const item = {
  id: "2032112f-4957-43d7-99db-4ee94d178eff",
  eventType: "CASE_CLOSED",
  title: "Объявление закрыто",
  message: "Кот дома",
  read: false,
  readAt: null,
  createdAt: "2026-10-11T10:00:00Z",
  caseId: null,
  needId: null,
  responseId: null,
  assignmentId: null,
  actionUrl: null,
}

test("notification center escapes backend text, exposes unread count and read controls", () => {
  const container = ({ children }) => React.createElement("div", null, children)
  const { NotificationCenter } = load(
    "components/common/NotificationCenter/NotificationCenter.tsx",
    {
      "@/hooks": {
        useUnreadCount: () => ({ data: { count: 120 } }),
        useReadNotifications: () => ({
          isPending: false,
          isError: false,
          mutate() {},
        }),
        useInbox: () => ({
          isPending: false,
          isError: false,
          data: {
            content: [
              {
                ...item,
                title: "<script>bad()</script>",
                message: "<img src=x onerror=alert(1)>",
              },
            ],
            totalPages: 1,
          },
        }),
      },
      "@/api": { getErrorMessage: (error) => error.message },
      "@/lib/inbox": events,
      "next/navigation": { useRouter: () => ({ push() {} }) },
      "@/components/ui": {
        Button: ({ children, ...props }) => {
          delete props.variant
          delete props.size
          return React.createElement("button", props, children)
        },
        Dialog: container,
        DialogTrigger: container,
        DialogContent: container,
        DialogHeader: container,
        DialogTitle: container,
        DialogDescription: container,
        Skeleton: container,
      },
      "../FormAlert/FormAlert": { FormAlert: () => null },
      "../ListPagination/ListPagination": { ListPagination: () => null },
    },
  )
  const html = renderToStaticMarkup(React.createElement(NotificationCenter))
  assert.ok(html.includes("непрочитанных: 120"))
  assert.ok(html.includes("99+"))
  assert.ok(html.includes("Прочитать все"))
  assert.ok(html.includes("Не прочитано"))
  assert.ok(html.includes("&lt;script&gt;"))
  assert.ok(html.includes("&lt;img"))
  assert.equal(html.includes("<script>"), false)
})

test("SSE parser handles fragmented UTF-8, CRLF, heartbeat and multiline data", async () => {
  const bytes = new TextEncoder().encode(
    ': heartbeat\r\nevent: notification\r\ndata: Привет\r\ndata: кот\r\n\r\nevent: unread-count\ndata: {"count":3}\n\n',
  )
  const response = new Response(
    new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
        controller.close()
      },
    }),
  )
  const received = []
  await events.consumeEvents(response, (event, data) =>
    received.push([event, data]),
  )
  assert.deepEqual(received, [
    ["notification", "Привет\nкот"],
    ["unread-count", '{"count":3}'],
  ])
})

test("notifications validate payload and restrict navigation to case pages", () => {
  assert.equal(events.inboxNotificationSchema.safeParse(item).success, true)
  assert.equal(
    events.inboxNotificationSchema.safeParse({ ...item, id: undefined })
      .success,
    false,
  )
  assert.equal(events.unreadCountSchema.safeParse({ count: -1 }).success, false)
  assert.equal(
    events.notificationHref(
      "https://evil.test/cases/2032112f-4957-43d7-99db-4ee94d178eff",
    ),
    null,
  )
  assert.equal(
    events.notificationHref("/cases/2032112f-4957-43d7-99db-4ee94d178eff"),
    "/cases/2032112f-4957-43d7-99db-4ee94d178eff",
  )
  // Deadline events without actionUrl lead to the case and its need.
  const caseId = "2032112f-4957-43d7-99db-4ee94d178eff"
  const needId = "8a6c2f8e-4f0e-4c1a-9d4e-2f7b9c3d1e5a"
  assert.equal(
    events.inboxItemHref({ actionUrl: null, caseId, needId }),
    `/cases/${caseId}?need=${needId}`,
  )
  assert.equal(
    events.inboxItemHref({ actionUrl: null, caseId: null, needId }),
    null,
  )
  // HELP_OFFER_MATCHED and other need events open the case at that need.
  assert.equal(
    events.notificationHref(
      "/cases/2032112f-4957-43d7-99db-4ee94d178eff",
      "8a6c2f8e-4f0e-4c1a-9d4e-2f7b9c3d1e5a",
    ),
    "/cases/2032112f-4957-43d7-99db-4ee94d178eff?need=8a6c2f8e-4f0e-4c1a-9d4e-2f7b9c3d1e5a",
  )
  assert.equal(
    events.notificationHref(
      "/cases/2032112f-4957-43d7-99db-4ee94d178eff",
      "x&next=//evil.test",
    ),
    "/cases/2032112f-4957-43d7-99db-4ee94d178eff",
  )
  assert.equal(
    events.notificationHref(null, "8a6c2f8e-4f0e-4c1a-9d4e-2f7b9c3d1e5a"),
    null,
  )
})

test("SSE adds a notification once without exceeding page size", () => {
  const { prependNotification } = load("lib/inbox/cache.ts")
  const page = {
    page: 0,
    size: 1,
    content: [{ ...item, id: "other" }],
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
  }
  const updated = prependNotification(page, item)
  assert.equal(updated.content.length, 1)
  assert.equal(updated.content[0].id, item.id)
  assert.equal(updated.totalElements, 2)
  assert.equal(updated.last, false)
  assert.equal(prependNotification(updated, item), updated)
  assert.equal(prependNotification(undefined, item), undefined)
})

test("stream deduplicates deliveries, uses absolute counts and stops on logout", async () => {
  let signal,
    connects = 0
  const notifications = [],
    counts = []
  const { startInboxStream } = load("hooks/model/inboxStream.ts", {
    "@/api": {
      ApiError: class extends Error {},
      inboxApi: {
        stream: async (requestSignal) => {
          signal = requestSignal
          return new Response(
            new ReadableStream({
              start(controller) {
                for (const [event, value] of [
                  ["notification", item],
                  ["notification", item],
                  ["notification", { bad: true }],
                  ["unread-count", { count: 5 }],
                  ["unread-count", { count: 2 }],
                ])
                  controller.enqueue(
                    new TextEncoder().encode(
                      `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`,
                    ),
                  )
                requestSignal.addEventListener(
                  "abort",
                  () => controller.error(new Error("aborted")),
                  { once: true },
                )
              },
            }),
          )
        },
      },
    },
    "@/lib/auth": { readTokens: () => ({ accessToken: "token" }) },
    "@/lib/inbox": events,
  })
  const stop = startInboxStream({
    isCurrent: () => true,
    onConnected: () => connects++,
    onNotification: (value) => notifications.push(value),
    onCount: (value) => counts.push(value),
  })
  await new Promise((resolve) => setTimeout(resolve, 30))
  stop()
  await new Promise((resolve) => setTimeout(resolve, 10))
  assert.equal(signal.aborted, true)
  assert.equal(connects, 1)
  assert.equal(notifications.length, 1)
  assert.deepEqual(counts, [5, 2])
})

test("stream reconnects with REST reconciliation and cancels its pending retry", async () => {
  let attempts = 0,
    reconciliations = 0
  const { startInboxStream } = load("hooks/model/inboxStream.ts", {
    "@/api": {
      ApiError: class extends Error {},
      inboxApi: {
        stream: async () => {
          attempts++
          return new Response("", {
            headers: { "Content-Type": "text/event-stream" },
          })
        },
      },
    },
    "@/lib/auth": { readTokens: () => ({ accessToken: "token" }) },
    "@/lib/inbox": events,
  })
  const stop = startInboxStream({
    isCurrent: () => true,
    onConnected: () => reconciliations++,
    onNotification() {},
    onCount() {},
  })
  await new Promise((resolve) => setTimeout(resolve, 1100))
  stop()
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(attempts, 2)
  assert.equal(reconciliations, 2)
})
