// Shared vm loader for the OTP flow tests (registration, password reset).
import vm from "node:vm"
import fs from "node:fs"
import ts from "typescript"
import path from "node:path"
import { createRequire } from "node:module"

const nodeRequire = createRequire(import.meta.url)

// Pass an array to load several files through one module graph (shared ApiError class).
export function load(file, { fetch, local = new Map(), session = new Map(), overrides = {} } = {}) {
  const storage = (map) => ({
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  })
  const context = {
    AbortSignal,
    AbortController,
    setTimeout,
    clearTimeout,
    URL,
    Headers,
    Response,
    TextEncoder,
    FormData,
    localStorage: storage(local),
    sessionStorage: storage(session),
    window: { dispatchEvent() {} },
    navigator: { language: "be-BY" },
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
        fs.existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, "index.ts"),
      )
    }
    vm.runInNewContext(`(function(exports, require) { ${compiled}\n})`, context)(
      exports,
      requireModule,
    )
    return exports
  }
  return Array.isArray(file) ? file.map(loadModule) : loadModule(file)
}
export const response = (status, body, headers = {}) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  })
export const failure = (status, error, message = "Ошибка", extra = {}) =>
  response(status, {
    message,
    details: { errorId: "id", errorCode: String(status), error, ...extra },
  })
