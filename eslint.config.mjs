import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/api/*",
                "@/hooks/*",
                "@/types/*",
                "@/components/common/*",
                "@/components/layouts/*",
                "@/components/pages/*",
                "@/components/providers/*",
                "@/components/ui/*",
                "@/lib/auth/*",
                "@/lib/constants/*",
                "@/lib/forms/*",
                "@/lib/dictionaries/*",
                "@/lib/images/*",
                "@/lib/validation/*",
              ],
              message:
                "Use the module's public index.ts. Inside a module, use relative imports.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
])

export default eslintConfig
