import type { Page } from "@playwright/test"
import type { ModerationTarget } from "../../types"

export const ids = {
  user: "10000000-0000-4000-8000-000000000001",
  owner: "10000000-0000-4000-8000-000000000002",
  animalCase: "20000000-0000-4000-8000-000000000001",
  need: "30000000-0000-4000-8000-000000000001",
  report: "40000000-0000-4000-8000-000000000001",
  notification: "50000000-0000-4000-8000-000000000001",
  conversation: "60000000-0000-4000-8000-000000000001",
}
export const now = "2026-11-01T10:00:00Z"
export const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=",
  "base64",
)
export const user = {
  id: ids.user,
  email: "helper@example.test",
  displayName: "Тестовый помощник",
  roles: ["USER"],
  locale: "ru",
  emailVerifiedAt: now,
  cityCode: "minsk",
  bio: "Помогаю животным",
  avatarUrl: null,
  homeLatitude: null,
  homeLongitude: null,
}
export const types = [
  {
    code: "FOSTER",
    nameRu: "Передержка",
    nameBe: "Ператрымка",
    active: true,
    sortOrder: 10,
  },
  {
    code: "TRANSPORT",
    nameRu: "Транспорт",
    nameBe: "Транспарт",
    active: true,
    sortOrder: 20,
  },
  { code: "FOOD", nameRu: "Корм", nameBe: "Корм", active: true, sortOrder: 30 },
]
export const cities = [
  {
    region: "MINSK",
    center: {
      code: "minsk",
      nameRu: "Минск",
      nameBe: "Мінск",
      latitude: 53.9,
      longitude: 27.56,
    },
    cities: [
      {
        code: "minsk",
        nameRu: "Минск",
        nameBe: "Мінск",
        latitude: 53.9,
        longitude: 27.56,
      },
    ],
  },
]
export const photos = Array.from({ length: 3 }, (_, position) => ({
  id: `70000000-0000-4000-8000-00000000000${position + 1}`,
  url: `/images/test/photo-${position + 1}.png`,
  position,
}))
export const detail = {
  id: ids.animalCase,
  title: "Рыжий кот ищет дом",
  animalType: "CAT",
  status: "OPEN",
  cityCode: "minsk",
  createdAt: now,
  description: "Спокойный и ласковый кот.\nНужна помощь.",
  sex: "UNKNOWN",
  approximateAge: "2",
  condition: "Здоров",
  photoUrl: photos[0].url,
  photos,
  author: { id: ids.owner, displayName: "Автор объявления", avatarUrl: null },
  needs: [
    {
      id: ids.need,
      type: "FOOD",
      status: "OPEN",
      priority: "MEDIUM",
      comment: "Нужен корм",
      startsAt: null,
      deadline: null,
      details: {},
      createdAt: now,
    },
  ],
  latitude: 53.9,
  longitude: 27.56,
  notificationsEnabled: null,
}
export const notification = {
  id: ids.notification,
  eventType: "CASE_CLOSED",
  title: "Новый отклик",
  message: "На объявление появился помощник",
  read: false,
  readAt: null,
  createdAt: now,
  caseId: ids.animalCase,
  needId: null,
  responseId: null,
  assignmentId: null,
  actionUrl: `/cases/${ids.animalCase}`,
}
export const report = {
  id: ids.report,
  reporterId: ids.user,
  targetId: ids.animalCase,
  targetType: "CASE",
  status: "NEW",
  message: "Проверьте это объявление",
  resolution: null,
  moderatorComment: null,
  moderatedBy: null,
  moderatedAt: null,
  createdAt: now,
  updatedAt: now,
}
export function pageOf<T>(content: T[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalPages: content.length ? 1 : 0,
    totalElements: content.length,
    first: true,
    last: true,
  }
}

export async function installFixture(
  page: Page,
  {
    signedIn = true,
    moderator = false,
    owner = false,
    withNotification = false,
  }: {
    signedIn?: boolean
    moderator?: boolean
    owner?: boolean
    withNotification?: boolean
  } = {},
) {
  const currentUser = {
    ...user,
    ...(owner ? { id: ids.owner } : {}),
    roles: moderator ? ["MODERATOR"] : ["USER"],
  }
  if (signedIn)
    await page.addInitScript(() =>
      localStorage.setItem(
        "lapalink.session",
        JSON.stringify({
          accessToken: "e2e-access",
          refreshToken: "e2e-refresh",
        }),
      ),
    )
  const state = {
    currentUser,
    notifications: [structuredClone(notification)],
    complaints: [] as (typeof report)[],
    responses: [] as {
      id: string
      needId: string
      message: string
      status: string
      user: { id: string; displayName: string }
      createdAt: string
    }[],
    report: structuredClone(report),
    detail: structuredClone(detail),
    calls: [] as { path: string; method: string; body: string | null }[],
    staleFilter: false,
    moderationConflict: false,
    galleryConflict: false,
    moderationTarget: {
      type: "CASE",
      caseId: ids.animalCase,
      authorId: ids.owner,
      title: detail.title,
      description: detail.description,
      status: detail.status,
      closedAt: null,
    } as ModerationTarget,
  }
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  )
  await page.route("**/images/**", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  )
  await page.routeWebSocket("**/ws", (socket) => {
    const subscriptions = new Map<string, string>()
    const deliver = (body: unknown) => {
      const subscription = subscriptions.get("/user/queue/messages")
      if (subscription)
        socket.send(
          `MESSAGE\nsubscription:${subscription}\nmessage-id:test-message\ndestination:/user/queue/messages\ncontent-type:application/json\n\n${JSON.stringify(body)}\0`,
        )
    }
    socket.onMessage((raw) => {
      const frame = String(raw).trimStart()
      const lines = frame.split("\n")
      const header = (name: string) =>
        lines
          .find((line) => line.startsWith(`${name}:`))
          ?.slice(name.length + 1)
      if (frame.startsWith("CONNECT"))
        socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0")
      if (frame.startsWith("SUBSCRIBE"))
        subscriptions.set(header("destination")!, header("id")!)
      if (
        frame.startsWith("SEND") &&
        header("destination")?.endsWith("/messages")
      ) {
        const payload = JSON.parse(
          frame.slice(frame.indexOf("\n\n") + 2).replace(/\0$/, ""),
        )
        deliver({
          id: "80000000-0000-4000-8000-000000000001",
          conversationId: ids.conversation,
          senderId: currentUser.id,
          clientMessageId: payload.clientMessageId,
          text: payload.text,
          createdAt: now,
        })
        deliver({
          id: "80000000-0000-4000-8000-000000000002",
          conversationId: ids.conversation,
          senderId: ids.owner,
          clientMessageId: "90000000-0000-4000-8000-000000000002",
          text: "Спасибо, будем ждать!",
          createdAt: now,
        })
      }
    })
  })
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace("/api/v1", "")
    const method = request.method()
    state.calls.push({
      path: `${path}${url.search}`,
      method,
      body: request.postData(),
    })
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, json: body })
    if (path === "/cities") return json(cities)
    if (path === "/need-types")
      return json(
        state.staleFilter
          ? types.filter((type) => type.code !== "TRANSPORT")
          : types,
      )
    if (path === "/case-close-reasons")
      return json([
        {
          code: "OWNER_FOUND",
          nameRu: "Найден хозяин",
          nameBe: "Знойдзены гаспадар",
          requiresComment: false,
        },
      ])
    if (path === "/account/me") return json(currentUser)
    if (path === "/auth/registration" || path === "/auth/password/forgot")
      return json({
        requestId: "request-1",
        expiresInSeconds: 300,
        resendAvailableInSeconds: 0,
      })
    if (path === "/auth/otp/confirm")
      return json({
        confirmationToken: "confirmation-1",
        type: "EMAIL_VERIFICATION",
        expiresInSeconds: 600,
      })
    if (path === "/auth/registration/complete" || path === "/auth/login")
      return json({ accessToken: "e2e-access", refreshToken: "e2e-refresh" })
    if (path === "/account/notification-channels")
      return json([
        {
          channel: "EMAIL",
          enabled: true,
          title: "Почта",
          quietFrom: null,
          quietTo: null,
        },
        {
          channel: "IN_APP",
          enabled: true,
          title: "В приложении",
          quietFrom: null,
          quietTo: null,
        },
      ])
    if (path === "/account/notifications")
      return json([{ eventType: "WELCOME", channel: "EMAIL", enabled: true }])
    if (path === "/account/inbox/stream")
      return route.fulfill({
        contentType: "text/event-stream",
        body: `event: unread-count\ndata: ${JSON.stringify({ count: state.notifications.filter((item) => !item.read).length })}\n\n${withNotification ? `event: notification\ndata: ${JSON.stringify(state.notifications[0] ?? notification)}\n\n` : ""}`,
      })
    if (path === "/account/inbox/unread-count")
      return json({
        count: state.notifications.filter((item) => !item.read).length,
      })
    if (path === "/account/inbox" && method === "DELETE") {
      const { ids: selected } = request.postDataJSON()
      state.notifications = state.notifications.filter(
        (item) => !selected.includes(item.id),
      )
      return route.fulfill({ status: 204 })
    }
    if (path === "/account/inbox") return json(pageOf(state.notifications))
    if (path === "/account/inbox/read-all") {
      state.notifications.forEach((item) => {
        item.read = true
      })
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith("/read") && path.startsWith("/account/inbox/")) {
      const item = state.notifications.find((entry) => path.includes(entry.id))
      if (item) item.read = true
      return json(item)
    }
    if (path === "/admin/complaints")
      return json(
        pageOf(
          !url.searchParams.get("status") ||
            url.searchParams.get("status") === state.report.status
            ? [state.report]
            : [],
        ),
      )
    if (path === `/admin/complaints/${ids.report}`) return json(state.report)
    if (path === `/admin/complaints/${ids.report}/target`)
      return json(state.moderationTarget)
    if (
      path.startsWith(`/admin/complaints/${ids.report}/`) &&
      method === "POST"
    ) {
      if (state.moderationConflict) {
        state.report.status = "RESOLVED"
        return json(
          {
            message: "Жалоба уже рассмотрена",
            details: { error: "COMPLAINT_ALREADY_PROCESSED" },
          },
          409,
        )
      }
      state.report.status = path.endsWith("/take")
        ? "IN_PROGRESS"
        : path.endsWith("/reject")
          ? "REJECTED"
          : "RESOLVED"
      state.report.moderatorComment = request.postDataJSON()?.comment
      return json(state.report)
    }
    if (path === "/complaints" && method === "POST") {
      state.complaints.push({ ...report, ...request.postDataJSON() })
      return json(state.complaints.at(-1), 201)
    }
    if (path === "/complaints/my") return json(pageOf(state.complaints))
    if (path === "/cases" && method === "POST")
      return json({ ...state.detail, authorId: currentUser.id }, 201)
    if (path === `/cases/${ids.animalCase}/needs` && method === "POST")
      return json(state.detail.needs[0], 201)
    if (path === `/cases/${ids.animalCase}/needs`)
      return json(state.detail.needs)
    if (path === `/cases/${ids.animalCase}`) return json(state.detail)
    if (
      path === `/cases/${ids.animalCase}/photos/order` &&
      method === "PATCH"
    ) {
      if (state.galleryConflict) {
        state.detail.photos = [...state.detail.photos].reverse()
        state.detail.photoUrl = state.detail.photos[0].url
        return json(
          {
            message: "Порядок фото изменился в другой вкладке",
            details: { error: "INVALID_CASE_PHOTO_ORDER" },
          },
          400,
        )
      }
      const order: string[] = request.postDataJSON().photoIds
      state.detail.photos = order.map((id, position) => ({
        ...state.detail.photos.find((photo) => photo.id === id)!,
        position,
      }))
      state.detail.photoUrl = state.detail.photos[0]?.url
      return json(state.detail.photos)
    }
    if (path === `/needs/${ids.need}/responses` && method === "POST") {
      const response = {
        id: "response-1",
        needId: ids.need,
        message: request.postDataJSON().message,
        status: "PENDING",
        user: { id: ids.user, displayName: user.displayName },
        createdAt: now,
      }
      state.responses.push(response)
      return json(response, 201)
    }
    if (path === `/cases/${ids.animalCase}/responses`)
      return json(pageOf(state.responses))
    if (
      path.startsWith("/responses/") &&
      path.endsWith("/assign") &&
      method === "POST"
    ) {
      if (state.responses[0]) state.responses[0].status = "ACCEPTED"
      state.detail.needs[0].status = "ASSIGNED"
      return json({
        id: "assignment-1",
        status: "ACTIVE",
        need: state.detail.needs[0],
        application: state.responses[0],
        createdAt: now,
      })
    }
    if (path === "/cases" || path === "/account/help-offers/matching-cases") {
      if (
        state.staleFilter &&
        url.searchParams.getAll("needType").includes("TRANSPORT")
      )
        return json(
          {
            message: "Этот тип помощи больше недоступен",
            details: { error: "UNKNOWN_NEED_TYPE" },
          },
          400,
        )
      return json(
        pageOf([
          {
            ...state.detail,
            distanceKm: null,
            shortDescription: detail.description,
            openNeedTypes: ["FOOD"],
            topNeed: {
              type: "FOOD",
              priority: "MEDIUM",
              startsAt: null,
              deadline: null,
              comment: "Нужен корм",
            },
          },
        ]),
      )
    }
    if (path.endsWith("/map")) return json({ items: [], truncated: false })
    if (path === "/chat/unread-count") return json({ count: 0 })
    if (path.endsWith("/chat-permission") || path.endsWith("/chat/permission"))
      return json({
        targetType: "CASE",
        targetId: ids.animalCase,
        enabled: false,
        canRequest: false,
        conversationId: null,
        conversationStatus: null,
      })
    if (path === "/chat/conversations") return json(pageOf([]))
    if (path === `/chat/conversations/${ids.conversation}`)
      return json({
        id: ids.conversation,
        targetType: "CASE",
        targetId: ids.animalCase,
        targetTitle: detail.title,
        status: "ACTIVE",
        participants: [
          {
            userId: currentUser.id,
            displayName: currentUser.displayName,
            role: "INITIATOR",
            lastReadAt: null,
          },
          {
            userId: ids.owner,
            displayName: "Автор",
            role: "OWNER",
            lastReadAt: null,
          },
        ],
        writable: true,
        unreadCount: 0,
        lastMessageAt: null,
        createdAt: now,
        closedAt: null,
        closedBy: null,
        hidden: false,
      })
    if (path.endsWith("/messages"))
      return json([
        {
          id: "message-1",
          conversationId: ids.conversation,
          senderId: ids.owner,
          clientMessageId: "message-client-1",
          text: "Здравствуйте! Кот ещё ищет помощь",
          createdAt: now,
          editedAt: null,
          deletedAt: null,
        },
      ])
    if (path.startsWith("/chat/") && path.endsWith("/read"))
      return route.fulfill({ status: 204 })
    if (path === "/account/help-offers") return json([])
    if (path.startsWith("/account/")) return json(pageOf([]))
    if (path.endsWith("/history")) return json([])
    return json(
      {
        message: `Нет тестового контракта: ${method} ${path}`,
        details: { error: "NOT_FOUND" },
      },
      404,
    )
  })
  return state
}
