import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";
import globals from "globals";

const elementTypes = [
  // Layer 0 & 1: Framework Foundation
  { type: "framework-foundation", pattern: "packages/types/**" },
  { type: "framework-foundation", pattern: "packages/contracts/**" },
  { type: "framework-foundation", pattern: "packages/schemas/**" },

  // Layer 2: Framework Ports
  { type: "framework-port", pattern: "packages/ports/**" },

  // Layer 3: Framework Adapters
  { type: "framework-adapter", pattern: "packages/adapters/**" },

  // Layer 4: Framework Primitives & Core Runtime
  { type: "framework-primitive", pattern: "packages/core/**" },
  { type: "framework-primitive", pattern: "packages/container/**" },
  { type: "framework-primitive", pattern: "packages/config/**" },
  { type: "framework-primitive", pattern: "packages/orm/**" },
  { type: "framework-primitive", pattern: "packages/commands/**" },
  { type: "framework-primitive", pattern: "packages/http/**" },
  { type: "framework-primitive", pattern: "packages/events/**" },
  { type: "framework-primitive", pattern: "packages/traits/**" },
  { type: "framework-primitive", pattern: "packages/pipeline/**" },
  { type: "framework-primitive", pattern: "packages/security/**" },
  { type: "framework-primitive", pattern: "packages/orchestration/**" },
  { type: "framework-primitive", pattern: "packages/telemetry/**" },
  { type: "framework-primitive", pattern: "packages/auth/**" },
  { type: "framework-primitive", pattern: "packages/migrations/**" },
  { type: "framework-primitive", pattern: "packages/plugin-engine/**" },
  { type: "framework-primitive", pattern: "packages/database/**" },
  { type: "framework-primitive", pattern: "packages/control-plane/**" },
  { type: "framework-primitive", pattern: "packages/theme/**" },

  // Layer 5: Runtime Entry & Tooling
  { type: "runtime-entry", pattern: "packages/gateway/**" },
  { type: "dev-tooling", pattern: "packages/cli/**" },
  { type: "dev-tooling", pattern: "packages/dev-server/**" },
  { type: "dev-tooling", pattern: "packages/dev-session/**" },
  { type: "dev-tooling", pattern: "packages/watcher/**" },
  { type: "dev-tooling", pattern: "packages/conformance/**" },
  { type: "dev-tooling", pattern: "packages/ui-runtime/**" },
  { type: "dev-tooling", pattern: "packages/testing/**" },

  // Layer 6: SDK
  { type: "sdk", pattern: "packages/sdk/**" },

  // Layer 7: Bounded Applications & Plugins
  { type: "app-domain", pattern: "apps/*/src/domain/**" },
  { type: "app-application", pattern: "apps/*/src/application/**" },
  { type: "app-infrastructure", pattern: "apps/*/src/infrastructure/**" },
  { type: "app-composition-root", pattern: "apps/*/src/composition-root.ts" },
  { type: "app-general", pattern: "apps/**" },
  { type: "plugin", pattern: "plugins/**" },

  // Historical server entry (src/): composition helper, not a BAC.
  // Must only use BAC public composition contracts.
  { type: "server", pattern: "src/server/**" },
];

const ignores = [
  "**/dist/**",
  "node_modules/**",
  ".pnpm-store/**",
  "coverage/**",
  "**/*.js",
  "**/*.cjs",
  "**/*.mjs",
  "**/*.d.ts",
  "remotion/.agents/**",
];

export default [
  {
    ignores: ignores,
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      boundaries: boundaries,
    },
    settings: {
      "boundaries/elements": elementTypes,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "framework-foundation", allow: ["framework-foundation"] },
            {
              from: "framework-port",
              allow: ["framework-port", "framework-foundation"],
            },
            {
              from: "framework-adapter",
              allow: [
                "framework-adapter",
                "framework-port",
                "framework-foundation",
              ],
            },
            {
              from: "framework-primitive",
              allow: [
                "framework-primitive",
                "framework-port",
                "framework-foundation",
              ],
            },
            {
              from: "runtime-entry",
              allow: [
                "runtime-entry",
                "framework-primitive",
                "framework-port",
                "framework-foundation",
              ],
            },
            {
              from: "sdk",
              allow: [
                "sdk",
                "framework-primitive",
                "framework-port",
                "framework-foundation",
              ],
            },
            {
              from: "dev-tooling",
              allow: [
                "dev-tooling",
                "sdk",
                "framework-primitive",
                "framework-port",
                "framework-foundation",
              ],
            },
            { from: "app-domain", allow: ["framework-foundation", "sdk"] },
            {
              from: "app-application",
              allow: ["app-domain", "framework-foundation", "sdk"],
            },
            {
              from: "app-infrastructure",
              allow: [
                "app-infrastructure",
                "app-application",
                "app-domain",
                "framework-port",
                "framework-adapter",
                "framework-foundation",
                "sdk",
              ],
            },
            {
              from: "app-composition-root",
              allow: [
                "app-general",
                "app-domain",
                "app-application",
                "app-infrastructure",
                "sdk",
                "framework-primitive",
                "framework-port",
                "framework-adapter",
                "framework-foundation",
              ],
            },
            {
              from: "app-general",
              allow: [
                "app-general",
                "sdk",
                "framework-primitive",
                "framework-port",
                "framework-foundation",
              ],
            },
            {
              from: "plugin",
              allow: ["plugin", "sdk", "framework-foundation"],
            },
            // Server orchestration: BAC internals forbidden — use
            // apps/<bac>/src/composition-root.ts (public contract).
            // NOTE: boundaries only sees *resolvable* specifiers; the repo's
            // ESM `.js` suffixes rarely resolve, so the real enforcement is
            // the `no-restricted-imports` block below (specifier strings).
            {
              from: "server",
              allow: [
                "server",
                "app-composition-root",
                "sdk",
                "framework-primitive",
                "framework-port",
                "framework-foundation",
                "framework-adapter",
              ],
            },
          ],
        },
      ],
    },
  },
  {
    // Persistance explicite (decision in-memory repo-wide) : aucun
    // `new InMemory*` hors tests/bench — exiger une DB (fail-fast) ou un
    // opt-in documente. Exemptions ciblees uniquement via
    // `eslint-disable-next-line no-restricted-syntax -- motif` (couche 2,
    // volatilite by-design, transport sans DB).
    files: ["**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.bench.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "NewExpression[callee.name=/^InMemory/], NewExpression[callee.property.name=/^InMemory/]",
          message:
            "Stockage en memoire interdit hors tests/bench : exigez un DatabasePort (fail-fast) ou documentez l'opt-in (mock explicite, volatilite by-design, couche 2).",
        },
      ],
    },
  },
  {
    // Enforceable BAC encapsulation for the historical server layer.
    // Unlike boundaries (resolution-based, blind to ESM `.js` specifiers),
    // this matches specifier strings, so `../../apps/<bac>/src/domain/*.js`
    // and friends are rejected in CI. Public contracts
    // (`apps/<bac>/src/composition-root.ts`, `apps/<bac>/src/index.ts`)
    // remain allowed. Scoped to src/server/** only — src/shell/** keeps its
    // legacy deep imports (orchestrator/migrations) until migrated.
    files: ["src/server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // One entry per layer and relative depth used under src/server/
              // (src/server/*.ts -> ../../apps, */*.ts -> ../../../apps).
              // NOTE: `**/` cannot match `..` segments and brace expansion
              // (`{a,b}`) is not honored by this rule/version, so entries
              // are enumerated explicitly. Covers static imports only —
              // dynamic import() is covered by no-restricted-syntax below.
              group: [
                "../../apps/*/src/domain/**",
                "../../apps/*/src/infrastructure/**",
                "../../apps/*/src/presentation/**",
                "../../apps/*/src/application/**",
                "../../apps/*/src/commands/**",
                "../../../apps/*/src/domain/**",
                "../../../apps/*/src/infrastructure/**",
                "../../../apps/*/src/presentation/**",
                "../../../apps/*/src/application/**",
                "../../../apps/*/src/commands/**",
              ],
              message:
                "src/server must not import BAC internal layers — use the BAC public composition contract (apps/<bac>/src/composition-root.ts).",
            },
          ],
        },
      ],
      // Same boundary for dynamic import() specifiers (string literals),
      // which no-restricted-imports does not inspect.
      // Plus the repo-wide persistence invariant (see block above): repeated
      // here because this later block overrides `no-restricted-syntax` for
      // src/server/** files.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "ImportExpression > Literal[value=/\\/apps\\/[^/]+\\/src\\/(domain|infrastructure|presentation|application|commands)\\//]",
          message:
            "src/server must not dynamically import BAC internal layers — use the BAC public composition contract (apps/<bac>/src/composition-root.ts).",
        },
        {
          selector:
            "NewExpression[callee.name=/^InMemory/], NewExpression[callee.property.name=/^InMemory/]",
          message:
            "Stockage en memoire interdit hors tests/bench : exigez un DatabasePort (fail-fast) ou documentez l'opt-in (mock explicite, volatilite by-design, couche 2).",
        },
      ],
    },
  },
];
