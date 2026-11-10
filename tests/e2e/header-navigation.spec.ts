import { expect, test } from "@playwright/test"
import { installFixture } from "./fixtures"

test("desktop header keeps primary actions visible and groups personal links", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await installFixture(page)
  await page.route("**/api/v1/chat/unread-count", (route) =>
    route.fulfill({ json: { count: 2 } }),
  )
  await page.goto("/cases")

  const header = page.getByRole("banner")
  await expect(
    header.getByRole("link", { name: "Объявления", exact: true }),
  ).toHaveAttribute("aria-current", "page")
  await expect(
    header.getByRole("link", { name: "Подать объявление" }),
  ).toBeVisible()
  await expect(
    header.getByRole("link", { name: "Сообщения, непрочитанных: 2" }),
  ).toBeVisible()
  await expect(
    header.getByRole("link", { name: "Мои объявления" }),
  ).toHaveCount(0)
  await expect(
    page.getByRole("navigation", { name: "Быстрое меню" }),
  ).toBeHidden()

  const profile = header.getByRole("button", { name: "Меню профиля" })
  await profile.click()
  const menu = page.getByRole("menu")
  await expect(
    menu.getByRole("menuitem", { name: "Мои отклики" }),
  ).toBeVisible()
  await expect(
    menu.getByRole("menuitem", { name: "Заявки на дом" }),
  ).toBeVisible()
  await menu.getByRole("menuitem", { name: "Мои объявления" }).click()
  await expect(page).toHaveURL(/\/my-cases$/)
  await profile.click()
  await expect(
    menu.getByRole("menuitem", { name: "Мои объявления" }),
  ).toHaveAttribute("aria-current", "page")
})

test("narrow header fits the screen and leaves quick links in the bottom bar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await installFixture(page)
  await page.goto("/cases")

  const header = page.getByRole("banner")
  const bottomNav = page.getByRole("navigation", { name: "Быстрое меню" })
  await expect(
    header.getByRole("button", { name: /^Уведомления/ }),
  ).toBeVisible()
  await expect(
    header.getByRole("button", { name: "Меню профиля" }),
  ).toBeVisible()
  await expect(
    header.getByRole("button", { name: "Открыть меню" }),
  ).toHaveCount(0)
  await expect(header.getByRole("link", { name: /^Сообщения/ })).toBeHidden()
  await expect(
    bottomNav.getByRole("link", { name: /^Сообщения/ }),
  ).toBeVisible()
  await expect(bottomNav.getByRole("link", { name: "Подать" })).toBeVisible()
  expect(
    await header.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual(320)
})
