import { test } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import ts from "typescript"
import path from "node:path"
import { createRequire } from "node:module"

const nodeRequire = createRequire(import.meta.url)

function loadTsModule(relativePath) {
  const filePath = path.resolve(relativePath)
  const source = fs.readFileSync(filePath, "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const mod = { exports: {} }
  const context = {
    module: mod,
    exports: mod.exports,
    require: (specifier) => {
      if (specifier.startsWith("@/")) {
        return loadTsModule(
          path.resolve(path.dirname(filePath), specifier.slice(2)),
        )
      }
      return nodeRequire(specifier)
    },
  }
  vm.runInNewContext(
    `(function(module, exports, require) { ${compiled} \n})`,
    context,
  )(mod, mod.exports, context.require)
  return mod.exports
}

test("my tasks route is available for the helper workflow", () => {
  const routesPath = "lib/constants/routes.ts"
  const routeFile = fs.readFileSync(routesPath, "utf8")

  assert.match(routeFile, /MY_TASKS\s*:/)
  assert.match(routeFile, /MY_TASKS:\s*"\/my-tasks"/)
  assert.ok(fs.existsSync("app/(main)/my-tasks/page.tsx"))
})

test("my tasks grouping keeps one task item per need and merges active assignment state", () => {
  const { buildMyTaskGroups } = loadTsModule("lib/tasks.ts")

  const groups = buildMyTaskGroups(
    [
      {
        id: "response-1",
        status: "PENDING",
        message: "Могу помочь",
        need: { id: "need-1", type: "FOSTER" },
        animalCase: { id: "case-1", title: "Кошка", photoUrl: null },
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: "response-2",
        status: "CANCELLED",
        message: "Не смог",
        need: { id: "need-1", type: "FOSTER" },
        animalCase: { id: "case-1", title: "Кошка", photoUrl: null },
        createdAt: "2025-01-02T00:00:00Z",
      },
    ],
    [
      {
        id: "assignment-1",
        status: "ACTIVE",
        need: { id: "need-1", type: "FOSTER" },
        animalCase: { id: "case-1", title: "Кошка", photoUrl: null },
        createdAt: "2025-01-03T00:00:00Z",
        updatedAt: "2025-01-03T00:00:00Z",
      },
    ],
  )

  assert.equal(groups.pending.length, 0)
  assert.equal(groups.active.length, 1)
  assert.equal(groups.cancelled.length, 0)
  assert.equal(groups.active[0].needId, "need-1")
})

test("my tasks grouping skips incomplete account records instead of crashing", () => {
  const { buildMyTaskGroups } = loadTsModule("lib/tasks.ts")

  const groups = buildMyTaskGroups(
    [
      {
        id: "response-1",
        status: "PENDING",
        message: "Могу помочь",
        need: { id: "need-1", type: "FOSTER" },
        animalCase: { id: "case-1", title: "Кошка", photoUrl: null },
        createdAt: "2025-01-01T00:00:00Z",
      },
      {
        id: "response-2",
        status: "PENDING",
        message: "хорошо",
        need: undefined,
        animalCase: undefined,
        createdAt: "2025-01-02T00:00:00Z",
      },
    ],
    [
      {
        id: "assignment-1",
        status: "ACTIVE",
        need: { id: "need-2", type: "MEDICAL" },
        animalCase: { id: "case-2", title: "Собака", photoUrl: null },
        createdAt: "2025-01-03T00:00:00Z",
        updatedAt: "2025-01-03T00:00:00Z",
      },
      {
        id: "assignment-2",
        status: "ACTIVE",
        need: undefined,
        animalCase: undefined,
        createdAt: "2025-01-04T00:00:00Z",
        updatedAt: "2025-01-04T00:00:00Z",
      },
    ],
  )

  assert.equal(groups.pending.length, 1)
  assert.equal(groups.pending[0].needId, "need-1")
  assert.equal(groups.active.length, 1)
  assert.equal(groups.active[0].needId, "need-2")
})
