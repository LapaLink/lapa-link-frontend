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
  const filter = feed.toFeedFilter(parse("search=кот&needType=FOSTER&cityCode="), 6)
  await casesApi.list(filter)
  await casesApi.matching(filter)
  assert.equal(
    calls[0][0],
    "/api/v1/cases?search=%D0%BA%D0%BE%D1%82&needType=FOSTER&orderBy=NEWEST&page=0&size=6",
  )
  assert.equal(calls[0][1], null)
  assert.equal(
    calls[1][0],
    "/api/v1/account/help-offers/matching-cases?search=%D0%BA%D0%BE%D1%82&needType=FOSTER&orderBy=NEWEST&page=0&size=6",
  )
  assert.equal(calls[1][1], "Bearer access")
  assert.ok(calls.every(([url]) => !url.includes("sort=")))

  const anonymous = load("api/cases.ts", { fetch })
  await assert.rejects(anonymous.casesApi.matching(filter), { status: 401 })
})
