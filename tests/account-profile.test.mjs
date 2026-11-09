import { test } from "node:test"
import assert from "node:assert/strict"
import { load } from "./otp-loader.mjs"

test("profile save keeps the home point because the PUT replaces every field", () => {
  const { toUpdateProfileDto } = load("components/pages/Account/schemas.ts")
  const values = { displayName: "Анна", cityCode: "__none", bio: "  ", phone: "" }
  // Spread: the vm realm has its own Object.prototype.
  assert.deepEqual(
    { ...toUpdateProfileDto(values, { homeLatitude: 53.9, homeLongitude: 27.56 }) },
    {
      displayName: "Анна",
      cityCode: null,
      bio: null,
      phone: null,
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

test("the profile form sends the saved phone as is; it changes only by SMS", () => {
  const { toUpdateProfileDto } = load("components/pages/Account/schemas.ts")
  const values = { displayName: "Анна", cityCode: "minsk", bio: "" }
  assert.equal(toUpdateProfileDto(values, { phone: "+375291234567" }).phone, "+375291234567")
  assert.equal(toUpdateProfileDto(values, {}).phone, null)
  // A phone typed into the values is ignored.
  assert.equal(toUpdateProfileDto({ ...values, phone: "+375000000000" }, {}).phone, null)
})
