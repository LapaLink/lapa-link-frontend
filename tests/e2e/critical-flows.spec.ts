import { expect, test } from "@playwright/test"
import {
  detail,
  ids,
  image,
  installFixture,
  notification,
  now,
} from "./fixtures"

test("registration → OTP → onboarding → feed", async ({ page }) => {
  await installFixture(page, { signedIn: false })
  await page.goto("/register")
  await page.getByLabel("Электронная почта").fill("new@example.test")
  await page.getByRole("button", { name: "Получить код" }).click()
  await expect(page).toHaveURL(/\/register\/code$/)
  await page.getByRole("textbox").fill("123456")
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click()
  await page.getByLabel("Ваше имя", { exact: true }).fill("Новый помощник")
  await page.getByLabel("Пароль", { exact: true }).fill("TestPassword123")
  await page
    .getByLabel("Повторите пароль", { exact: true })
    .fill("TestPassword123")
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click()
  await expect(page).toHaveURL(/\/welcome$/)
  for (let step = 0; step < 4; step++)
    await page.getByRole("button", { name: /Пропустить/ }).click()
  await page.getByRole("link", { name: "Найти, кому помочь" }).click()
  await expect(page).toHaveURL(/\/cases$/)
  await expect(page.getByText(detail.title).first()).toBeVisible()
})

test("create wizard keeps values, accepts multiple photos and geolocation, then publishes", async ({
  page,
  context,
}) => {
  const state = await installFixture(page)
  await context.grantPermissions(["geolocation"])
  await context.setGeolocation({ latitude: 53.9, longitude: 27.56 })
  await page.goto("/cases/create")
  await page.getByRole("combobox", { name: "Кого нашли?" }).click()
  await page.getByRole("option", { name: "Кошку" }).click()
  await page.getByLabel("Заголовок").fill("Найден кот у парка")
  await page.getByRole("button", { name: "Далее", exact: true }).click()
  await page.getByRole("button", { name: "Назад", exact: true }).click()
  await expect(page.getByLabel("Заголовок")).toHaveValue("Найден кот у парка")
  await page.getByRole("button", { name: "Далее", exact: true }).click()
  await page.getByRole("button", { name: "Далее", exact: true }).click()
  await page.locator('input[type="file"][multiple]').setInputFiles([
    { name: "cat-1.png", mimeType: "image/png", buffer: image },
    { name: "cat-2.png", mimeType: "image/png", buffer: image },
  ])
  await expect(page.getByText(/2 из 10/)).toBeVisible()
  await page.getByRole("button", { name: "Далее", exact: true }).click()
  await page.getByRole("button", { name: /местоположение|геолокац/i }).click()
  await expect(
    page.getByRole("combobox", { name: "Город", exact: true }),
  ).toHaveText("Минск")
  await page.getByRole("button", { name: "Далее", exact: true }).click()
  await page.getByLabel("Корм", { exact: true }).check()
  await page.getByRole("button", { name: /Опубликовать/ }).click()
  await expect
    .poll(
      () =>
        state.calls.filter(
          (call) => call.path === "/cases" && call.method === "POST",
        ).length,
    )
    .toBe(1)
  const created = state.calls.find(
    (call) => call.path === "/cases" && call.method === "POST",
  )!
  expect(created.body).toContain('name="photos"')
  expect(created.body).not.toContain('name="photo";')
  expect(created.body).toContain("53.9")
  await page
    .getByRole("link", { name: /Открыть объявление|Перейти к объявлению/ })
    .first()
    .click()
  await expect(page).toHaveURL(new RegExp(`/cases/${ids.animalCase}$`))
})

test("helper responds, owner selects the helper and an assignment appears", async ({
  page,
}) => {
  const state = await installFixture(page)
  await page.goto(`/cases/${ids.animalCase}`)
  await page.getByRole("button", { name: "Предложить помощь" }).first().click()
  await page
    .getByLabel("Сообщение автору")
    .fill("Могу привезти корм завтра. Telegram: @example")
  await page.getByRole("button", { name: "Отправить", exact: true }).click()
  await expect.poll(() => state.responses.length).toBe(1)
  state.currentUser.id = ids.owner
  await page.reload()
  await page
    .getByRole("button", { name: /Выбрать помощника/ })
    .first()
    .click()
  await page.getByRole("button", { name: "Выбрать помощником" }).click()
  await page.getByRole("button", { name: "Выбрать", exact: true }).click()
  await expect.poll(() => state.responses[0].status).toBe("ACCEPTED")
  await expect.poll(() => state.detail.needs[0].status).toBe("ASSIGNED")
})

test("complaint appears in My Complaints without moderator-only fields", async ({
  page,
}) => {
  const state = await installFixture(page)
  await page.goto(`/cases/${ids.animalCase}`)
  await page.getByRole("button", { name: "Пожаловаться", exact: true }).click()
  await page
    .getByRole("menuitem", { name: "На объявление", exact: true })
    .click()
  await page.getByRole("textbox").fill("Проверьте информацию об этом животном")
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отправить", exact: true })
    .click()
  await expect.poll(() => state.complaints.length).toBe(1)
  await page.goto("/account#complaints")
  await expect(
    page.getByText("Проверьте информацию об этом животном"),
  ).toBeVisible()
  await expect(page.getByText("Комментарий модератора:")).toHaveCount(0)
})

test("moderator reviews and rejects a report with a reason", async ({
  page,
}) => {
  const state = await installFixture(page, { moderator: true })
  await page.goto("/moderation/reports")
  await page.getByRole("button", { name: /Рассмотреть жалобу/ }).click()
  await page.getByRole("button", { name: "Взять в работу" }).click()
  await expect.poll(() => state.report.status).toBe("IN_PROGRESS")
  await page.screenshot({
    path: test.info().outputPath("moderation-mobile.png"),
    fullPage: true,
  })
  await page
    .getByRole("button", { name: "Отклонить жалобу", exact: true })
    .click()
  await page
    .getByLabel("Причина решения")
    .fill("Нарушение не подтвердилось после проверки")
  await page.getByRole("button", { name: "Подтвердить", exact: true }).click()
  await expect.poll(() => state.report.status).toBe("REJECTED")
  await expect(
    page.getByText("Нарушение не подтвердилось после проверки", {
      exact: false,
    }),
  ).toBeVisible()
})

test("concurrent moderation recovers with the other moderator's status", async ({
  page,
}) => {
  const state = await installFixture(page, { moderator: true })
  await page.goto("/moderation/reports")
  await page.getByRole("button", { name: /Рассмотреть жалобу/ }).click()
  state.moderationConflict = true
  await page.getByRole("button", { name: "Взять в работу" }).click()
  await expect(page.getByText(/уже изменились/)).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Взять в работу" }),
  ).toHaveCount(0)
})

test("ordinary user cannot query moderation even by opening its URL", async ({
  page,
}) => {
  const state = await installFixture(page)
  await page.goto("/moderation/reports")
  await expect(page.getByText("Раздел для модераторов")).toBeVisible()
  expect(
    state.calls.filter((call) => call.path.startsWith("/admin/")),
  ).toHaveLength(0)
})

test("notification event → read all → select → confirmed delete", async ({
  page,
}) => {
  const state = await installFixture(page, { withNotification: true })
  state.notifications.push({
    ...notification,
    id: "50000000-0000-4000-8000-000000000002",
    title: "Второе уведомление",
  })
  await page.goto("/cases")
  await expect(page.getByText("Новый отклик", { exact: true })).toBeVisible()
  await expect(
    page.getByRole("button", { name: /Уведомления, непрочитанных: 2/ }),
  ).toBeVisible()
  await page.getByRole("button", { name: /Уведомления/ }).click()
  await page.screenshot({
    path: test.info().outputPath("notifications-mobile.png"),
    fullPage: true,
  })
  await page.getByRole("button", { name: "Прочитать все" }).click()
  await expect.poll(() => state.notifications[0].read).toBe(true)
  await page.getByLabel("Выбрать на странице").check()
  await page.getByRole("button", { name: "Удалить (2)" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Удалить", exact: true })
    .click()
  await expect(page.getByText("Пока тихо")).toBeVisible()
  expect(state.notifications).toHaveLength(0)
})

test("gallery supports keyboard, fullscreen focus, escape and touch swipe", async ({
  page,
}) => {
  await installFixture(page)
  await page.goto(`/cases/${ids.animalCase}`)
  const open = page.getByRole("button", {
    name: "Открыть фото 1 из 3 на весь экран",
  })
  await open.click()
  const viewer = page.getByRole("dialog")
  await expect(viewer).toHaveCSS("height", "844px")
  await page.keyboard.press("ArrowRight")
  await expect(viewer.getByRole("status")).toHaveText("2 / 3")
  await page.screenshot({
    path: test.info().outputPath("gallery-fullscreen-mobile.png"),
  })
  await page.keyboard.press("Escape")
  await expect(viewer).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Открыть фото 2 из 3 на весь экран" }),
  ).toBeFocused()
  const surface = page.getByRole("button", {
    name: "Открыть фото 2 из 3 на весь экран",
  })
  await surface.dispatchEvent("pointerdown", { clientX: 250, clientY: 200 })
  await surface.dispatchEvent("pointerup", { clientX: 100, clientY: 200 })
  await expect(
    page.getByRole("button", { name: "Открыть фото 3 из 3 на весь экран" }),
  ).toBeVisible()
})

test("stale multi-type filter refreshes its dictionary and cleans the URL", async ({
  page,
}) => {
  const state = await installFixture(page)
  await page.goto(
    "/cases?needType=FOOD&needType=TRANSPORT&priority=HIGH&cityCode=minsk",
  )
  await expect(page.getByText(detail.title).first()).toBeVisible()
  state.staleFilter = true
  await page.getByRole("searchbox", { name: "Поиск", exact: true }).fill("кот")
  await expect(page).not.toHaveURL(/needType=TRANSPORT/)
  await expect(page).toHaveURL(/needType=FOOD/)
  await expect(page).toHaveURL(/priority=HIGH/)
  await expect(page.getByText(detail.title).first()).toBeVisible()
})

test("chat loads real message content and preserves the typed draft", async ({
  page,
}) => {
  await installFixture(page)
  await page.goto(`/chats/${ids.conversation}`)
  await expect(
    page.getByText("Здравствуйте! Кот ещё ищет помощь"),
  ).toBeVisible()
  const input = page.getByPlaceholder(/Напишите сообщение/)
  await input.fill("Готов помочь завтра")
  await expect(input).toHaveValue("Готов помочь завтра")
  await page.getByRole("button", { name: "Отправить", exact: true }).click()
  await expect(page.getByText("Спасибо, будем ждать!")).toBeVisible()
  await expect(
    page.getByText("Готов помочь завтра", { exact: true }),
  ).toHaveCount(1)
})

test("moderation reads a complaint snapshot without using ordinary chat history", async ({
  page,
}) => {
  const state = await installFixture(page, { moderator: true })
  state.report.targetType = "CONVERSATION"
  state.moderationTarget = {
    type: "CONVERSATION",
    conversationId: ids.conversation,
    chatTargetType: "CASE",
    chatTargetId: ids.animalCase,
    chatTitle: "Проверка переписки",
    participantIds: [ids.user, ids.owner],
    messages: [
      {
        messageId: "snapshot-1",
        senderId: ids.owner,
        text: "Сообщение из снимка жалобы",
        createdAt: now,
        editedAt: null,
        deletedAt: null,
      },
    ],
  }
  await page.goto("/moderation/reports")
  await page.getByRole("button", { name: /Рассмотреть жалобу/ }).click()
  await expect(page.getByText("Сообщение из снимка жалобы")).toBeVisible()
  expect(
    state.calls.some(
      (call) =>
        call.path.startsWith("/chat/conversations/") &&
        call.path.includes("/messages"),
    ),
  ).toBe(false)
})

test("a failed notification delete keeps records and can be retried", async ({
  page,
}) => {
  const state = await installFixture(page)
  let failing = true
  await page.route("**/api/v1/account/inbox", (route) =>
    route.request().method() === "DELETE" && failing
      ? route.abort("failed")
      : route.fallback(),
  )
  await page.goto("/cases")
  await page.getByRole("button", { name: /Уведомления/ }).click()
  await page.getByRole("button", { name: "Удалить: Новый отклик" }).click()
  const confirmation = page.getByRole("alertdialog")
  await confirmation
    .getByRole("button", { name: "Удалить", exact: true })
    .click()
  await expect(
    confirmation.getByText(/Не удалось связаться с сервером/),
  ).toBeVisible()
  expect(state.notifications).toHaveLength(1)
  failing = false
  await confirmation
    .getByRole("button", { name: "Удалить", exact: true })
    .click()
  await expect(page.getByText("Пока тихо")).toBeVisible()
  await expect(confirmation).toHaveCount(0)
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("button", { name: "Уведомления", exact: true }),
  ).toBeVisible()
})

test("URL changes restore the search editor without replacing the restored query with an old draft", async ({
  page,
}) => {
  await installFixture(page)
  await page.goto("/cases?search=кот")
  await expect(
    page.getByRole("searchbox", { name: "Поиск", exact: true }),
  ).toHaveValue("кот")
  await page.evaluate(() =>
    window.history.pushState(null, "", "/cases?search=собака"),
  )
  await expect(
    page.getByRole("searchbox", { name: "Поиск", exact: true }),
  ).toHaveValue("собака")
  await expect(page).toHaveURL(
    /search=(%D1%81%D0%BE%D0%B1%D0%B0%D0%BA%D0%B0|собака)/,
  )
})

test("stale gallery refetches server order instead of guessing photo positions", async ({
  page,
}) => {
  const state = await installFixture(page, { owner: true })
  await page.goto(`/cases/${ids.animalCase}/edit`)
  await expect(
    page.getByRole("button", { name: "Сделать фото 2 обложкой", exact: true }),
  ).toBeVisible()
  const reads = state.calls.filter(
    (call) => call.path === `/cases/${ids.animalCase}` && call.method === "GET",
  ).length
  state.galleryConflict = true
  await page
    .getByRole("button", { name: "Сделать фото 2 обложкой", exact: true })
    .click()
  await expect(
    page.getByText("Порядок фото изменился в другой вкладке"),
  ).toBeVisible()
  await expect
    .poll(
      () =>
        state.calls.filter(
          (call) =>
            call.path === `/cases/${ids.animalCase}` && call.method === "GET",
        ).length,
    )
    .toBeGreaterThan(reads)
  await expect(
    page.getByRole("img", { name: "Фото 1", exact: true }),
  ).toHaveAttribute("src", /photo-3/)
})

test("chat composer stays reachable above navigation after a mobile viewport resize", async ({
  page,
}) => {
  await installFixture(page)
  await page.goto(`/chats/${ids.conversation}`)
  const input = page.getByRole("textbox", { name: "Сообщение", exact: true })
  await input.fill("Помогу завтра")
  await page.setViewportSize({ width: 390, height: 430 })
  await input.scrollIntoViewIfNeeded()
  const inputBox = await input.boundingBox()
  const navigation = await page
    .getByRole("navigation", { name: "Быстрое меню" })
    .boundingBox()
  expect(inputBox!.y + inputBox!.height).toBeLessThanOrEqual(navigation!.y)
})

for (const width of [320, 375, 390, 430, 768, 1440]) {
  test(`layout ${width}px: core screens do not overflow horizontally`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await installFixture(page, { moderator: true })
    for (const path of [
      "/cases",
      "/cases/create",
      `/cases/${ids.animalCase}`,
      "/account",
      "/welcome",
      "/moderation/reports",
      "/my-tasks",
      "/my-cases",
      `/chats/${ids.conversation}`,
    ]) {
      await page.goto(path)
      await expect(page.locator("main")).toBeVisible()
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
      ).toBeVisible()
      await expect
        .poll(
          () =>
            page.evaluate(
              () => document.documentElement.scrollWidth - window.innerWidth,
            ),
          { message: `${path} at ${width}px` },
        )
        .toBeLessThanOrEqual(1)
      if ((width === 320 || width === 1440) && path === "/cases")
        await page.screenshot({
          path: test.info().outputPath(`feed-${width}.png`),
          fullPage: true,
        })
    }
  })
}
