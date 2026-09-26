/**
 * @mosaix/conformance — Integrity Rules Definitions.
 */

export type IntegritySeverity = "error" | "warn";

export interface IntegrityRule {
  id: string;
  alias?: string;
  severity: IntegritySeverity;
  message: string;
  remediation?: string;
  /** Case-insensitive regex tested per line (must NOT use the /g/ flag). */
  pattern: RegExp;
  refine?: (captured: string) => boolean;
  /** File allowlist (relative POSIX path). Matched files are skipped. */
  allow?: string[];
  /** Only scan files matching at least one of these (default: TS sources). */
  include?: string[];
}

export const TS_SOURCES = [
  "src/**/*.ts",
  "apps/**/*.ts",
  "packages/**/*.ts",
  "scripts/**/*.ts",
];

export const INTEGRITY_RULES: IntegrityRule[] = [
  {
    id: "CONF-DB-001",
    alias: "no-ddl-outside-migrations",
    severity: "error",
    message:
      "DDL outside the migration engine — schema must come from a MigrationProvider (Registry → Planner → Runner), never from ad-hoc CREATE TABLE.",
    remediation:
      "Move table creation DDL into a migration provider or core migration script.",
    pattern: /CREATE\s+(TABLE|INDEX|UNIQUE\s+INDEX)/i,
    include: TS_SOURCES,
    allow: [
      "packages/migrations/**",
      "**/migrations.ts",
      "**/migration-*.ts",
      "src/shell/database/core-migration.ts",
      "src/shell/theme/theme-migrations.ts",
      "apps/imperia/src/domain/migration-governance.service.ts",
      "apps/commerce/src/infrastructure/order.repository.ts",
      "apps/subscription/src/domain/subscription.service.ts",
      "packages/core/src/platform-settings.ts",
      "packages/core/src/tenant-schema-manager.ts",
      "packages/feed-engine/src/feed-store.ts",
    ],
  },
  {
    id: "CONF-DB-002",
    alias: "no-direct-sqlite-driver",
    severity: "error",
    message:
      "Direct SQLite driver import — storage must go through DatabasePort/adapters, never node:sqlite directly.",
    remediation:
      "Use DatabasePort abstraction or sqlite adapter package instead of importing node:sqlite directly.",
    pattern: /node:sqlite|DatabaseSync|better-sqlite3/i,
    include: TS_SOURCES,
    allow: ["packages/adapters/database-sqlite/**"],
  },
  {
    id: "CONF-DB-003",
    alias: "no-swallowed-db-errors",
    severity: "warn",
    message:
      "Swallowed persistence error (.catch(() => null/[])) — DB failures become silent divergence between memory and storage.",
    remediation:
      "Handle DB errors explicitly or log/rethrow them rather than swallowing with empty catch.",
    pattern: /\.catch\(\s*\(\s*\)\s*=>\s*(null|\[\])\s*\)/,
    include: ["src/**/*.ts", "apps/**/*.ts"],
  },
  {
    id: "CONF-SESSION-001",
    alias: "no-memory-session-stores",
    severity: "error",
    message:
      "Process-memory session/auth store — sessions, codes and device bindings must live in the database (restart-safe, multi-instance).",
    remediation:
      "Persist sessions and auth codes in database tables via appropriate repository ports.",
    pattern:
      /(authCodes|drafts|storedCodes)\s*=\s*new\s+Map|private\s+static\s+(sessions|devices)\s*=\s*new\s+Map/i,
    include: ["src/**/*.ts", "apps/**/*.ts", "packages/**/*.ts"],
    allow: [
      "apps/citadelle/src/domain/registration-wizard.service.ts",
      "apps/portfolio/src/domain/product-wizard.service.ts",
      "apps/solara/src/domain/social-auto-share-plugin.ts",
      "packages/mobile-bridge/src/auth/refresh-token-rotator.ts",
      "packages/mobile-bridge/src/push/device-registry.ts",
      "src/server/routes/mobile-routes.ts",
    ],
  },
  {
    id: "CONF-SEC-001",
    alias: "no-plaintext-password-defaults",
    severity: "error",
    message:
      "Password held in cleartext process state — hash at collection or collect only at finalize; never persist cleartext.",
    remediation:
      "Ensure passwords are hashed (e.g. Scrypt) and avoid holding cleartext password defaults in state.",
    pattern: /password\s*:\s*""/,
    include: ["src/**/*.ts", "apps/**/*.ts"],
  },
  {
    id: "CONF-SEC-002",
    alias: "no-direct-identities-sql",
    severity: "error",
    message:
      "Raw SQL on the identities table outside the identity adapter — all identity reads/writes go through the IdentityStore port.",
    remediation:
      "Access identities via IdentityStore port or identity adapter rather than raw SQL.",
    pattern: /(FROM|INTO|UPDATE)\s+identities/i,
    include: TS_SOURCES,
    allow: [
      "packages/adapters/identity-store-sqlite/**",
      "packages/adapters/identity-store-postgres/**",
      "src/shell/anonymization-orchestrator.ts",
      "scripts/**",
    ],
  },
  {
    id: "CONF-SEC-003",
    alias: "no-mock-in-prod-path",
    severity: "warn",
    message:
      "Mock default in a production path (mock tokens, isMockMode: true) — fail fast in production instead.",
    remediation:
      "Remove hardcoded mock mode defaults in production code paths.",
    pattern: /isMockMode\s*[:=]\s*true|mock_token/i,
    include: ["src/**/*.ts", "apps/**/*.ts", "packages/**/*.ts"],
  },
  {
    id: "CONF-ID-001",
    alias: "no-math-random-ids",
    severity: "warn",
    message:
      "Math.random() entity IDs — use the id-uuid/id-ulid ports (collision-safe, non-predictable).",
    remediation:
      "Use crypto.randomUUID() or UUID/ULID ports instead of Math.random().",
    pattern: /Math\.random\(\)/,
    include: ["src/**/*.ts", "apps/**/*.ts"],
  },
  {
    id: "CONF-I18N-001",
    alias: "no-hardcoded-ui-text",
    severity: "warn",
    message:
      "Hardcoded user-facing text — extract to translation keys once the i18n catalog exists (see themes/_template/locales). No i18n infra in src/apps yet, so this stays warn by design.",
    remediation:
      "Extract hardcoded UI string literals into translation catalog keys.",
    pattern:
      />([^<>]{4,})<|(?:title|placeholder|aria-label|aria-description|alt)=["']([^"'<>]{3,})["']|(?:showToast|promiseConfirm)\(\s*['"]([^'"]{3,})['"]/,
    include: [
      "**/pages/**/*.ts",
      "**/presentation/**/*.ts",
      "**/views/**/*.ts",
      "**/renderer.ts",
      "**/*client-scripts.ts",
      "**/components/**/*.ts",
    ],
    refine: (captured: string): boolean => {
      const literal = captured
        .replace(/\$\{[^}]*\}/g, "")
        .replace(/\{[^}]*\}/g, "")
        .trim();
      if (/^(mosaix)(\s+platform)?$/i.test(literal)) return false;
      if (!/[a-zàâäéèêëîïôöùûüÿæœç]/i.test(literal)) return false;
      return /[\sàâäéèêëîïôöùûüÿæœç]/.test(literal) || literal.length >= 10;
    },
  },
  {
    id: "CONF-BOUNDARY-001",
    alias: "no-cross-bac-imports",
    severity: "error",
    message:
      "Direct cross-BAC import — Bounded Applications must communicate via Kernel capabilities/events, never by directly importing from another application's domain/infrastructure.",
    remediation:
      "Refactor cross-BAC imports to use Kernel capabilities, event bus, or shared contract packages.",
    pattern: /import\s+.*?\s+from\s+["'](\.\.\/)+([a-z0-9_-]+\/)+src\/(domain|infrastructure|persistence)|import\s+.*?\s+from\s+["']@apps\/[a-z0-9_-]+\/src\/(domain|infrastructure|persistence)/i,
    include: ["apps/**/*.ts"],
  },
];
