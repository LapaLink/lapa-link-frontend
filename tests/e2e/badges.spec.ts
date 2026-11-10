import { expect, test } from "@playwright/test"
import { detail, ids, installFixture, now, pageOf } from "./fixtures"

const badge = {
  code: "RELIABLE_HELPER",
  category: "HELPER",
  name: "Надёжный помощник",
  description: "Выполнил 5 назначений по помощи животным",
  icon: null,
}

test("my badges retry, refresh on an award and open from the inbox", async ({
  page,
}) => {
  await installFixture(page)
  let earned = false
  let requests = 0
  let authorization = ""
  const award = {
    id: ids.notification,
    eventType: "BADGE_AWARDED",
    title: "Новый значок",
    message: "Вы получили значок «Надёжный помощник»",
    read: false,
    readAt: null,
    createdAt: now,
  }

  await page.route("**/api/v1/account/badges", (route) => {
    authorization = route.request().headers().authorization
    if (++requests === 1)
      return route.fulfill({
        status: 503,
        json: { message: "Значки временно недоступны" },
      })
    return route.fulfill({
      json: [
        {
          ...badge,
          threshold: 5,
          progress: earned ? 5 : 3,
          earned,
          awardedAt: earned ? now : null,
        },
      ],
    })
  })
  await page.route("**/api/v1/account/inbox?**", (route) =>
    route.fulfill({ json: pageOf(earned ? [award] : []) }),
  )
  await page.route("**/api/v1/account/inbox/stream", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: earned
        ? `event: notification\ndata: ${JSON.stringify(award)}\n\n`
        : ": heartbeat\n\n",
    }),
  )

  await page.goto("/account#badges")
  await expect(page.getByText("Значки временно недоступны")).toBeVisible()
  await page.getByRole("button", { name: "Повторить" }).click()
  await expect(page.getByText("Получено 0 из 1")).toBeVisible()
  const medal = page.locator('img[src="/badges/reliable-helper.svg"]')
  await expect(medal).toBeVisible()
  await expect
    .poll(() => medal.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0)
  await expect(medal).toHaveCSS("opacity", "0.55")
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "3")
  expect(authorization).toBe("Bearer e2e-access")

  earned = true
  await expect(page.getByText(award.message)).toBeVisible()
  await expect(page.getByText("Получено 1 из 1")).toBeVisible()
  await expect(medal).toHaveCSS("opacity", "1")
  await expect(page.locator(`time[datetime="${now}"]`)).toBeVisible()
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)

  await page.getByRole("link", { name: "Личные данные" }).click()
  await page.getByRole("button", { name: /^Уведомления/ }).click()
  const previousRequests = requests
  await page.getByRole("button", { name: /^Новый значок/ }).click()
  await expect(page).toHaveURL(/\/account#badges$/)
  await expect(page.getByText("Получено 1 из 1")).toBeVisible()
  await expect.poll(() => requests).toBeGreaterThan(previousRequests)
})

test("guests can open recent and additional badges on a case", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await installFixture(page, { signedIn: false })
  const badges = Array.from({ length: 4 }, (_, index) => ({
    ...badge,
    icon: index === 3 ? "shield" : null,
    code: `BADGE_${index + 1}`,
    name: `Значок ${index + 1}`,
    awardedAt: `2026-11-0${index + 1}T10:00:00Z`,
  }))
  await page.route(`**/api/v1/cases/${ids.animalCase}`, (route) =>
    route.fulfill({
      json: { ...detail, author: { ...detail.author, badges } },
    }),
  )

  await page.goto(`/cases/${ids.animalCase}`)
  const authorBadges = page.getByRole("list", { name: "Значки автора" })
  await expect(
    authorBadges.locator('img[src="/badges/helper.svg"]'),
  ).toHaveCount(2)
  await expect(
    authorBadges.locator('img[src="/badges/trust.svg"]'),
  ).toHaveCount(1)
  await expect(authorBadges.getByRole("button").first()).toHaveAccessibleName(
    "Значок 4",
  )
  await expect(authorBadges.getByRole("button")).toHaveCount(4)
  await authorBadges.getByRole("button", { name: "Значок 4" }).click()
  await expect(page.getByRole("dialog")).toContainText(badge.description)
  await page.keyboard.press("Escape")
  await authorBadges
    .getByRole("button", { name: "Другие значки автора: 1" })
    .click()
  await expect(page.getByRole("dialog")).toContainText("Значок 1")
})
