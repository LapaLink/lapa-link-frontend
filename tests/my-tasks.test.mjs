import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"

test("my tasks route is available for the helper workflow", () => {
  const routesPath = "lib/constants/routes.ts"
  const routeFile = fs.readFileSync(routesPath, "utf8")

  assert.match(routeFile, /MY_TASKS\s*:/)
  assert.match(routeFile, /MY_TASKS:\s*"\/my-tasks"/)
  assert.ok(fs.existsSync("app/(main)/my-tasks/page.tsx"))
})
