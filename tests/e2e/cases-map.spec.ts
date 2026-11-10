import { expect, test } from "@playwright/test"
import { image, installFixture, user } from "./fixtures"

test.beforeEach(async ({ page }) => {
  await page.route("https://*.tile.openstreetmap.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: image }),
  )
})

test("saved location is marked and the map can return to it without changing filters", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await installFixture(page)
  await page.route("**/api/v1/account/me", (route) =>
    route.fulfill({
      json: { ...user, homeLatitude: 53.94315, homeLongitude: 27.49604 },
    }),
  )
  await page.goto("/cases")

  const section = page.getByRole("region", { name: "Карта объявлений" })
  const map = section.locator(".leaflet-container")
  const marker = map.locator(".leaflet-marker-icon").first()
  await expect(map.getByText("Ваша точка", { exact: true })).toBeVisible()
  await expect(map.getByRole("link", { name: "Leaflet" })).toHaveCount(0)
  await expect(map.getByRole("link", { name: "OpenStreetMap" })).toBeVisible()
  expect((await map.boundingBox())?.height).toBeGreaterThan(500)

  async function distanceFromCenter() {
    const [mapRect, markerRect] = await Promise.all([
      map.boundingBox(),
      marker.boundingBox(),
    ])
    if (!mapRect || !markerRect) return Infinity
    return Math.abs(
      markerRect.x + markerRect.width / 2 - mapRect.x - mapRect.width / 2,
    )
  }

  await expect.poll(distanceFromCenter).toBeLessThan(2)
  await map.focus()
  await page.keyboard.press("ArrowRight")
  await expect.poll(distanceFromCenter).toBeGreaterThan(30)
  await map.getByRole("button", { name: "К моей точке" }).click()
  await expect.poll(distanceFromCenter).toBeLessThan(2)
  await expect(page).toHaveURL(/\/cases$/)
})

test("on mobile the advanced controls open together and retain applied filters", async ({
  page,
  context,
}) => {
  await installFixture(page, { signedIn: false })
  await context.grantPermissions(["geolocation"])
  await context.setGeolocation({ latitude: 53.93, longitude: 27.49 })
  await page.goto("/cases")
  const filters = page.getByRole("button", { name: /^Ещё фильтры/ })
  const near = page.getByRole("button", { name: "Рядом со мной", exact: true })
  const priority = page.getByRole("combobox", { name: "Приоритет" })
  await expect(near).toBeHidden()
  await expect(priority).toBeHidden()
  await filters.click()
  await expect(near).toBeVisible()
  await expect(priority).toBeVisible()
  await expect(
    page.getByRole("combobox", { name: "Статус потребности" }),
  ).toBeVisible()
  await priority.click()
  await page.getByRole("option", { name: "Высокий", exact: true }).click()
  await expect(page).toHaveURL(/priority=HIGH/)
  await filters.click()
  await expect(priority).toBeHidden()
  await expect(filters).toContainText("1")
  await expect(page).toHaveURL(/priority=HIGH/)

  const map = page.getByRole("region", { name: "Карта объявлений" })
  await map.getByRole("button", { name: "Показать, где я" }).click()
  await expect(map.getByText("Вы здесь", { exact: true })).toBeVisible()
  await expect(map.getByRole("button", { name: "К моей точке" })).toBeVisible()
  await expect(page).toHaveURL(/\/cases\?priority=HIGH$/)
})
