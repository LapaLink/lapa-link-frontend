import { test } from "node:test"
import assert from "node:assert/strict"
import vm from "node:vm"
import fs from "node:fs"
import ts from "typescript"
import path from "node:path"
import { createRequire } from "node:module"

const nodeRequire = createRequire(import.meta.url)

function load(file, fetch, sharedStorage, locks, overrides = {}) {
  const storage = sharedStorage || new Map()
  const context = {
    AbortSignal: overrides.AbortSignal ?? AbortSignal,
    AbortController,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    URL,
    Headers,
    Response,
    Event,
    TextEncoder,
    FormData,
    File,
    Blob,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    window: overrides.window ?? { dispatchEvent() {} },
    navigator: { locks },
    fetch,
  }
  const modules = new Map()
  function loadModule(file) {
    const resolved = path.resolve(file)
    if (modules.has(resolved)) return modules.get(resolved)
    const exports = {}
    modules.set(resolved, exports)
    const compiled = ts.transpileModule(fs.readFileSync(resolved, "utf8"), {
      fileName: resolved,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    const requireModule = (specifier) => {
      if (specifier in overrides) return overrides[specifier]
      if (!specifier.startsWith("@/") && !specifier.startsWith("."))
        return nodeRequire(specifier)
      const base = specifier.startsWith("@/")
        ? path.resolve(specifier.slice(2))
        : path.resolve(path.dirname(resolved), specifier)
      return loadModule(
        fs.existsSync(`${base}.ts`)
          ? `${base}.ts`
          : path.join(base, "index.ts"),
      )
    }
    vm.runInNewContext(
      `(function(exports, require) { ${compiled}\n})`,
      context,
    )(exports, requireModule)
    return exports
  }
  const result = loadModule(file)
  return file.startsWith("api/")
    ? { ...result, ...loadModule("lib/auth/session.ts") }
    : result
}
const response = (status, body) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json" },
  })

function recorder(body = {}) {
  const calls = []
  const fetch = async (url, options) => {
    calls.push({
      url,
      method: options.method ?? "GET",
      body: options.body ? JSON.parse(options.body) : undefined,
      authorization: new Headers(options.headers).get("Authorization"),
    })
    return response(200, body)
  }
  return { calls, fetch }
}

test("a complaint about a case is sent with the session token", async () => {
  const { calls, fetch } = recorder({ id: "c1", status: "NEW" })
  const api = load("api/complaints.ts", fetch)
  api.saveTokens({ accessToken: "access", refreshToken: "refresh" })
  await api.complaintsApi.create({
    targetType: "CASE",
    targetId: "k1",
    message: "Продают",
  })
  assert.deepEqual(calls, [
    {
      url: "/api/v1/complaints",
      method: "POST",
      body: { targetType: "CASE", targetId: "k1", message: "Продают" },
      authorization: "Bearer access",
    },
  ])
})
