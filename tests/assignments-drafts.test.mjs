// Declining assignments, closing with active assignments, status history and drafts.
import { test } from "node:test"
import assert from "node:assert/strict"
import { load, response } from "./otp-loader.mjs"

const tokens = { accessToken: "access", refreshToken: "refresh" }

function recorder(body = {}) {
  const calls = []
  const fetch = async (url, options) => {
    calls.push([url, options.method ?? "GET", options.body ? JSON.parse(options.body) : undefined])
    return response(200, body)
  }
  const local = new Map([["lapalink.session", JSON.stringify(tokens)]])
  const [cases, account] = load(["api/cases.ts", "api/account.ts"], { fetch, local })
  return { calls, ...cases, ...account }
}

test("decline, reopen reason, close choice, publish, delete and history hit their endpoints", async () => {
  const { calls, casesApi, accountApi } = recorder()
  await casesApi.declineAssignment("a1", "Заболел, не смогу отвезти")
  await casesApi.updateNeedStatus("c1", "n1", "OPEN", "Не выходит на связь")
  await casesApi.close("c1", "PERMANENT_HOME", "Кота забрала семья", "COMPLETE")
  await casesApi.close("c1", "OTHER")
  await casesApi.publish("c1")
  await casesApi.deleteDraft("c1")
  await casesApi.history("c1")
  await accountApi.getCases(0, 20, undefined, "DRAFT")
  assert.deepEqual(calls, [
    ["/api/v1/assignments/a1/decline", "POST", { reason: "Заболел, не смогу отвезти" }],
    ["/api/v1/cases/c1/needs/n1", "PATCH", { status: "OPEN", reason: "Не выходит на связь" }],
    [
      "/api/v1/cases/c1/close",
      "POST",
      { reason: "PERMANENT_HOME", comment: "Кота забрала семья", activeAssignments: "COMPLETE" },
    ],
    // Without active assignments the choice is not sent at all.
    ["/api/v1/cases/c1/close", "POST", { reason: "OTHER" }],
    ["/api/v1/cases/c1/publish", "POST", undefined],
    ["/api/v1/cases/c1", "DELETE", undefined],
    ["/api/v1/cases/c1/history", "GET", undefined],
    ["/api/v1/account/cases?status=DRAFT&page=0&size=20", "GET", undefined],
  ])
})

test("a status change without a reason does not send one", async () => {
  const { calls, casesApi } = recorder()
  await casesApi.updateNeedStatus("c1", "n1", "CLOSED")
  assert.deepEqual(calls, [["/api/v1/cases/c1/needs/n1", "PATCH", { status: "CLOSED" }]])
})

test("history events read as text, unknown pairs show raw values", () => {
  const { describeHistoryEvent, historyActor } = load("lib/cases/history.ts")
  const event = (targetType, fromStatus, toStatus, actorId = "u1") => ({
    targetType,
    fromStatus,
    toStatus,
    actorId,
  })
  const cases = [
    [event("CASE", null, "DRAFT"), "Создан черновик"],
    [event("CASE", "DRAFT", "PENDING_REVIEW"), "Отправлено на модерацию"],
    [event("CASE", "PENDING_REVIEW", "OPEN"), "Опубликовано"],
    [event("CASE", null, "OPEN"), "Опубликовано"],
    [event("CASE", "PENDING_REVIEW", "REJECTED"), "Отклонено модератором"],
    [event("CASE", "OPEN", "CLOSED"), "Объявление закрыто"],
    [event("NEED", null, "OPEN"), "Добавлена потребность «Передержка»"],
    [event("NEED", "OPEN", "ASSIGNED"), "«Передержка»: выбран исполнитель"],
    [event("NEED", "ASSIGNED", "OPEN"), "«Передержка»: снова ищем помощника"],
    [event("NEED", "OPEN", "CLOSED"), "«Передержка»: закрыта"],
    [event("NEED", "OPEN", "CLOSED", null), "«Передержка»: закрыта (срок истёк)"],
    [event("ASSIGNMENT", null, "ACTIVE"), "Назначен исполнитель"],
    [event("ASSIGNMENT", "ACTIVE", "COMPLETED"), "Помощь оказана"],
    [event("ASSIGNMENT", "ACTIVE", "CANCELLED"), "Назначение отменено"],
    [event("HELP_APPLICATION", null, "PENDING"), "Новый отклик"],
    [event("HELP_APPLICATION", "PENDING", "ACCEPTED"), "Отклик принят"],
    [event("HELP_APPLICATION", "ACCEPTED", "CANCELLED"), "Отклик отменён"],
    [event("ADOPTION", null, "NEW"), "ADOPTION: — → NEW"],
    [event("CASE", "OPEN", "ARCHIVED"), "CASE: OPEN → ARCHIVED"],
  ]
  for (const [item, text] of cases)
    assert.equal(describeHistoryEvent(item, "Передержка"), text, JSON.stringify(item))

  const who = (targetType, actorId) =>
    historyActor({ targetType, actorId }, { authorId: "author", userId: "me" })
  assert.equal(who("NEED", null), "Автоматически")
  assert.equal(who("CASE", "author"), "Автор")
  assert.equal(who("ASSIGNMENT", "me"), "Вы")
  assert.equal(who("ASSIGNMENT", "helper"), "Исполнитель")
  assert.equal(who("HELP_APPLICATION", "helper"), "Исполнитель")
  assert.equal(who("CASE", "moderator"), "Модератор")
})

test("a cancelled assignment says who cancelled it and why", () => {
  const { cancellationSummary } = load("lib/tasks.ts")
  assert.equal(
    cancellationSummary({ cancelledBy: "me", cancelReason: "Заболел" }, "me"),
    "Вы отказались: Заболел",
  )
  assert.equal(
    cancellationSummary({ cancelledBy: "author", cancelReason: "Не на связи" }, "me"),
    "Автор отменил назначение. Причина: Не на связи",
  )
  assert.equal(
    cancellationSummary({ cancelledBy: "author", cancelReason: null }, "me"),
    "Автор отменил назначение.",
  )
  // Closing the case cancels with no one and no reason.
  assert.equal(
    cancellationSummary({ cancelledBy: null, cancelReason: null }, "me"),
    "Автор выбрал другого помощника или закрыл объявление.",
  )
})

test("an unknown case status shows its raw value instead of breaking", () => {
  const { caseStatusBadge } = load("components/pages/Cases/statusLabels.ts")
  assert.equal(caseStatusBadge("DRAFT").label, "Черновик")
  assert.equal(caseStatusBadge("ARCHIVED").label, "ARCHIVED")
  assert.equal(caseStatusBadge("ARCHIVED").tone, "muted")
})

test("hidden cases: history texts, status badge and the public FAQ request", async () => {
  const { describeHistoryEvent } = load("lib/cases/history.ts")
  const event = (fromStatus, toStatus) => ({ targetType: "CASE", fromStatus, toStatus, actorId: "m" })
  assert.equal(describeHistoryEvent(event("OPEN", "HIDDEN"), ""), "Скрыто модератором")
  assert.equal(describeHistoryEvent(event("HIDDEN", "OPEN"), ""), "Восстановлено модератором")
  const { caseStatusBadge } = load("components/pages/Cases/statusLabels.ts")
  assert.equal(caseStatusBadge("HIDDEN").label, "Скрыто модератором")
  assert.equal(caseStatusBadge("HIDDEN").tone, "danger")

  const calls = []
  const [faq] = load(["api/faq.ts"], {
    fetch: async (url, options) => {
      calls.push([url, options.headers.get("Authorization")])
      return response(200, [])
    },
  })
  await faq.faqApi.list()
  // Public: no token is needed or sent.
  assert.deepEqual(calls, [["/api/v1/faq", null]])
})
