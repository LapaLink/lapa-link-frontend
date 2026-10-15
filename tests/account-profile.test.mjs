import { test } from "node:test"
import assert from "node:assert/strict"
import { load } from "./otp-loader.mjs"

test("profile save keeps the home point because the PUT replaces every field", () => {
  const { toUpdateProfileDto } = load("components/pages/Account/schemas.ts")
  const values = { displayName: "Анна", cityCode: "__none", bio: "  " }
  // Spread: the vm realm has its own Object.prototype.
  assert.deepEqual(
    { ...toUpdateProfileDto(values, { homeLatitude: 53.9, homeLongitude: 27.56 }) },
    {
      displayName: "Анна",
      cityCode: null,
      bio: null,
      homeLatitude: 53.9,
      homeLongitude: 27.56,
    },
  )
  const withoutPoint = toUpdateProfileDto(
    { ...values, cityCode: "minsk", bio: "Помогаю" },
    {},
  )
  assert.equal(withoutPoint.cityCode, "minsk")
  assert.equal(withoutPoint.bio, "Помогаю")
  assert.equal(withoutPoint.homeLatitude, null)
  assert.equal(withoutPoint.homeLongitude, null)
})
