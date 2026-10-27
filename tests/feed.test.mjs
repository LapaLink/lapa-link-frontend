import { test } from "node:test"
import assert from "node:assert/strict"
import { load, response } from "./otp-loader.mjs"

const feed = load("lib/cases/feed.ts")
const parse = (query) => feed.parseFeedState(new URLSearchParams(query))
const tokens = { accessToken: "access", refreshToken: "refresh" }
const page = { content: [], totalPages: 0, totalElements: 0, page: 0, size: 6 }

test("feed URL: old ?title= links keep working as search", () => {
  assert.equal(parse("title=рыжий").search, "рыжий")
  assert.equal(parse("title=old&search=new").search, "new")
  assert.equal(feed.feedQueryString(parse("title=рыжий")), "search=%D1%80%D1%8B%D0%B6%D0%B8%D0%B9")
  assert.equal(parse(`search=${"я".repeat(250)}`).search.length, 200)
})

test("feed URL: invalid values are dropped and defaults are omitted", () => {
  const state = parse(
    "animalType=FISH&priority=URGENT&needStatus=OPEN&orderBy=PRIORITY&page=-2&mode=matching&cityCode=minsk",
  )
  assert.equal(state.animalType, undefined)
  assert.equal(state.priority, undefined)
  assert.equal(state.needStatus, "OPEN")
  assert.equal(state.orderBy, "PRIORITY")
  assert.equal(state.page, 0)
  assert.equal(state.mode, "matching")
  assert.equal(
    feed.feedQueryString(state),
    "mode=matching&cityCode=minsk&needStatus=OPEN&orderBy=PRIORITY",
  )
  assert.equal(feed.feedQueryString(parse("")), "")
  assert.equal(feed.hasFeedFilters(parse("mode=matching&page=3")), false)
  assert.equal(feed.hasFeedFilters(parse("needType=FOSTER")), true)
})

test("feed: several need types from repeated or comma-separated params", () => {
  const state = parse("needType=TRANSPORT&needType=FOOD,%20VET%20,,TRANSPORT&needType=")
  assert.deepEqual([...state.needTypes], ["TRANSPORT", "FOOD", "VET"])
  assert.equal(
    feed.feedQueryString(state),
    "needType=TRANSPORT&needType=FOOD&needType=VET",
  )
  assert.deepEqual([...parse("needType=,%20").needTypes], [])
  assert.equal(feed.toFeedFilter(parse("needType="), 6).needType, undefined)
  // Unknown or disabled codes are dropped before the request (UNKNOWN_NEED_TYPE).
  const filter = feed.toFeedFilter(state, 6, ["FOOD", "TRANSPORT"])
  assert.deepEqual([...filter.needType], ["TRANSPORT", "FOOD"])
  assert.equal(feed.toFeedFilter(parse("needType=OLD"), 6, ["FOOD"]).needType, undefined)
  assert.equal(feed.changeFeed(parse("needType=FOOD&page=4"), { needTypes: [] }).page, 0)
})

test("feed: radius and DISTANCE never go out without a full point", () => {
  for (const query of [
    "radiusKm=10&orderBy=DISTANCE",
    "latitude=53.9&radiusKm=10&orderBy=DISTANCE",
    "latitude=95&longitude=27&radiusKm=10&orderBy=DISTANCE",
  ]) {
    const state = parse(query)
    assert.equal(state.point, undefined, query)
    const filter = feed.toFeedFilter(state, 6)
    assert.equal(filter.radiusKm, undefined, query)
    assert.equal(filter.latitude, undefined, query)
    assert.equal(filter.orderBy, "NEWEST", query)
  }
  const near = parse("latitude=53.904123456&longitude=27.561&radiusKm=15&orderBy=DISTANCE&page=2")
  assert.deepEqual({ ...near.point }, { latitude: 53.904123456, longitude: 27.561 })
  const filter = feed.toFeedFilter(near, 6)
  assert.equal(filter.latitude, 53.90412)
  assert.equal(filter.radiusKm, 15)
  assert.equal(filter.orderBy, "DISTANCE")
  assert.equal(parse("latitude=53.9&longitude=27.5&radiusKm=101").radiusKm, undefined)
  assert.equal(parse("latitude=53.9&longitude=27.5&radiusKm=2.5").radiusKm, undefined)

  // Clearing the point drops radius and DISTANCE and returns to page 0.
  const cleared = feed.changeFeed(near, { point: undefined })
  assert.equal(cleared.radiusKm, undefined)
  assert.equal(cleared.orderBy, "NEWEST")
  assert.equal(cleared.page, 0)
  assert.equal(feed.changeFeed(near, { mode: "matching" }).page, 0)
})

test("feed API: no sort and no empty values; matching-cases needs the token", async () => {
  const calls = []
  const fetch = async (url, options) => {
    calls.push([url, options.headers?.get?.("Authorization") ?? null])
    return response(200, page)
  }
  const local = new Map([["lapalink.session", JSON.stringify(tokens)]])
  const { casesApi } = load("api/cases.ts", { fetch, local })
  const filter = feed.toFeedFilter(parse("search=кот&needType=FOSTER,FOOD&cityCode="), 6)
  await casesApi.list(filter)
  await casesApi.matching(filter)
  assert.equal(
    calls[0][0],
    "/api/v1/cases?search=%D0%BA%D0%BE%D1%82&needType=FOSTER&needType=FOOD&orderBy=NEWEST&page=0&size=6",
  )
  assert.equal(calls[0][1], null)
  assert.equal(
    calls[1][0],
    "/api/v1/account/help-offers/matching-cases?search=%D0%BA%D0%BE%D1%82&needType=FOSTER&needType=FOOD&orderBy=NEWEST&page=0&size=6",
  )
  assert.equal(calls[1][1], "Bearer access")
  assert.ok(calls.every(([url]) => !url.includes("sort=")))

  const anonymous = load("api/cases.ts", { fetch })
  await assert.rejects(anonymous.casesApi.matching(filter), { status: 401 })
})

test("gallery API: add as multipart photos, delete by id, reorder with all ids", async () => {
  const calls = []
  const gallery = [{ id: "p2", url: "/images/u/2.png", position: 0 }]
  const fetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body })
    return response(url.endsWith("/photos") ? 201 : 200, gallery)
  }
  const local = new Map([["lapalink.session", JSON.stringify(tokens)]])
  const { casesApi } = load("api/cases.ts", { fetch, local })
  const files = [
    new File(["a"], "a.png", { type: "image/png" }),
    new File(["b"], "b.jpg", { type: "image/jpeg" }),
  ]
  assert.deepEqual([...(await casesApi.addPhotos("c 1", files))], gallery)
  await casesApi.deletePhoto("c 1", "p1")
  await casesApi.reorderPhotos("c 1", ["p2", "p1"])
  assert.equal(calls[0].url, "/api/v1/cases/c%201/photos")
  assert.equal(calls[0].method, "POST")
  assert.deepEqual(calls[0].body.getAll("photos").map((file) => file.name), ["a.png", "b.jpg"])
  assert.equal(calls[1].url, "/api/v1/cases/c%201/photos/p1")
  assert.equal(calls[1].method, "DELETE")
  assert.equal(calls[2].url, "/api/v1/cases/c%201/photos/order")
  assert.equal(calls[2].method, "PATCH")
  assert.deepEqual(JSON.parse(calls[2].body), { photoIds: ["p2", "p1"] })
  assert.ok(calls.every(({ url }) => !/\/photo$/.test(url)))
})

test("gallery: client checks keep the limit and skip unsupported files", async () => {
  const { prepareCasePhotos } = load("lib/images/prepareCasePhotos.ts", {
    overrides: { "./downscaleImage": { downscaleImage: async (file) => file } },
  })
  const png = (name) => new File(["x"], name, { type: "image/png" })
  const full = await prepareCasePhotos([png("a.png")], 0)
  assert.equal(full.files.length, 0)
  assert.match(full.error, /не больше 10 фото/)
  const some = await prepareCasePhotos(
    [
      png("a.png"),
      new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
      new File([], "empty.png", { type: "image/png" }),
      png("b.png"),
      png("c.png"),
    ],
    3,
  )
  assert.deepEqual([...some.files.map((file) => file.name)], ["a.png"])
  assert.match(some.error, /Добавлены первые 3/)
  const ok = await prepareCasePhotos([png("a.png"), png("b.png")], 5)
  assert.equal(ok.files.length, 2)
  assert.equal(ok.error, "")
})

test("feed: DEADLINE order is kept, an unknown city is not sent, the map takes only filters", () => {
  assert.equal(parse("orderBy=DEADLINE").orderBy, "DEADLINE")
  assert.equal(feed.toFeedFilter(parse("orderBy=DEADLINE"), 6).orderBy, "DEADLINE")

  // UNKNOWN_CITY: codes are checked against /cities once it is loaded.
  assert.equal(feed.toFeedFilter(parse("cityCode=old"), 6, undefined, ["minsk"]).cityCode, undefined)
  assert.equal(feed.toFeedFilter(parse("cityCode=minsk"), 6, undefined, ["minsk"]).cityCode, "minsk")
  assert.equal(feed.toFeedFilter(parse("cityCode=minsk"), 6).cityCode, "minsk")

  const bounds = { minLat: 53.8, minLng: 27.4, maxLat: 54, maxLng: 27.7 }
  const filter = feed.toFeedFilter(
    parse("animalType=CAT&needType=FOOD&latitude=53.9&longitude=27.5&radiusKm=5&orderBy=DISTANCE&page=2"),
    6,
  )
  assert.deepEqual(JSON.parse(JSON.stringify(feed.toMapFilter(filter, bounds))), {
    animalType: "CAT",
    needType: ["FOOD"],
    ...bounds,
  })

  // INVALID_BOUNDS: min below max and at most 2° per axis.
  assert.equal(feed.isMapAreaAllowed(bounds), true)
  assert.equal(feed.isMapAreaAllowed({ ...bounds, maxLat: 55.8 }), true)
  assert.equal(feed.isMapAreaAllowed({ ...bounds, maxLat: 55.81 }), false)
  assert.equal(feed.isMapAreaAllowed({ ...bounds, maxLng: 27.4 }), false)
})
