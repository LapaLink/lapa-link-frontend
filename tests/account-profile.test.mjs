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

test("profile phone: spaces, brackets and dashes are dropped; empty means null", () => {
  const { toUpdateProfileDto, profileSchema } = load("components/pages/Account/schemas.ts")
  const base = { displayName: "Анна", cityCode: "minsk", bio: "" }
  const dto = (phone) => toUpdateProfileDto({ ...base, phone }, {}).phone
  assert.equal(dto("+375 (29) 123-45-67"), "+375291234567")
  assert.equal(dto("375291234567"), "375291234567")
  assert.equal(dto("   "), null)
  const valid = (phone) => profileSchema.safeParse({ ...base, phone }).success
  assert.equal(valid(""), true)
  assert.equal(valid("+375 29 123 45 67"), true)
  for (const bad of ["123456", "+3752912345678901", "abc1234567", "++375291234567"])
    assert.equal(valid(bad), false, bad)
})
