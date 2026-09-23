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
            { from: "framework-port", allow: ["framework-port", "framework-foundation"] },
            { from: "framework-adapter", allow: ["framework-adapter", "framework-port", "framework-foundation"] },
            { from: "framework-primitive", allow: ["framework-primitive", "framework-port", "framework-foundation"] },
            { from: "runtime-entry", allow: ["runtime-entry", "framework-primitive", "framework-port", "framework-foundation"] },
            { from: "sdk", allow: ["sdk", "framework-primitive", "framework-port", "framework-foundation"] },
            { from: "dev-tooling", allow: ["dev-tooling", "sdk", "framework-primitive", "framework-port", "framework-foundation"] },
            { from: "app-domain", allow: ["framework-foundation", "sdk"] },
            { from: "app-application", allow: ["app-domain", "framework-foundation", "sdk"] },
            { from: "app-infrastructure", allow: ["app-infrastructure", "app-application", "app-domain", "framework-port", "framework-adapter", "framework-foundation", "sdk"] },
            { from: "app-composition-root", allow: ["app-domain", "app-application", "app-infrastructure", "sdk", "framework-primitive", "framework-port", "framework-adapter", "framework-foundation"] },
            { from: "app-general", allow: ["app-general", "sdk", "framework-primitive", "framework-port", "framework-foundation"] },
            { from: "plugin", allow: ["plugin", "sdk", "framework-foundation"] },
          ],
        },
      ],
    },
  },
];
