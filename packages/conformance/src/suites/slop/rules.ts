/**
 * @mosaix/conformance — Slop Checker Rules Definition (PRD-0012)
 */

export type SlopSeverity = "error" | "warn";

export interface SlopRule {
  id: string;
  alias: string;
  severity: SlopSeverity;
  message: string;
  remediation: string;
  pattern: RegExp;
  refine?: (line: string, match: RegExpExecArray) => boolean;
  allow?: string[];
  include?: string[];
}

export const SLOP_RULES: SlopRule[] = [
  {
    id: "SLOP-P0-01",
    alias: "no-math-random",
    severity: "error",
    message: "Math.random() in application code — non-deterministic randoms cause ID collisions and non-repeatable state.",
    remediation: "Use crypto.randomUUID() or CryptoPort abstraction instead of Math.random().",
    pattern: /Math\.random\(\)/,
  },
  {
    id: "SLOP-P0-02",
    alias: "no-untracked-todo",
    severity: "error",
    message: "Untracked or bare TODO/FIXME/HACK/XXX comment — must include a ticket (#123, TICKET-123) or date (YYYY-MM-DD).",
    remediation: "Add an issue/ticket reference or target resolution date, e.g. 'TODO(#123): fix error handling'.",
    pattern: /\b(TODO|FIXME|HACK|XXX)\b/,
    refine: (line: string): boolean => {
      // Allow if line contains #number, ISSUE-123, PRD-123, or date YYYY-MM-DD
      if (/#\d+/.test(line)) return false;
      if (/[A-Z]+-\d+/.test(line)) return false;
      if (/\d{4}-\d{2}-\d{2}/.test(line)) return false;
      return true;
    },
  },
  {
    id: "SLOP-P0-03",
    alias: "no-unimplemented",
    severity: "error",
    message: "Unimplemented stub throw in production path — 'throw new Error(\"not implemented\")' fused stub detected.",
    remediation: "Implement the required behavior or use an explicit Port fallback safeguard.",
    pattern: /throw\s+new\s+Error\(\s*["']not implemented/i,
  },
  {
    id: "SLOP-P0-04",
    alias: "no-console",
    severity: "error",
    message: "Direct console.* logging call — production code must log via LoggingPort or ConsoleLogger.",
    remediation: "Use LoggingPort or ConsoleLogger instead of calling console.log/warn/error directly.",
    pattern: /console\.(log|warn|error|debug|trace)\s*\(/,
    refine: (line: string): boolean => {
      // Ignore comments
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      return true;
    },
    allow: [
      "scripts/**",
      "packages/cli/**",
      "packages/core/src/logging.ts",
      "packages/conformance/**",
    ],
  },
  {
    id: "SLOP-P0-05",
    alias: "no-alert",
    severity: "error",
    message: "Browser alert() or confirm() call in frontend view — prototype interaction element.",
    remediation: "Use declarative SSR navigation, toast notifications, or dialog overlays instead of browser alert().",
    pattern: /\b(alert|confirm)\s*\(/,
    refine: (line: string): boolean => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      return true;
    },
  },
  {
    id: "SLOP-P0-06",
    alias: "no-empty-catch",
    severity: "error",
    message: "Empty catch block swallowing errors silently.",
    remediation: "Log or rethrow the caught error, or add an explicit comment explaining why swallowing is safe.",
    pattern: /catch\s*(\([^)]*\))?\s*\{\s*\}/,
  },
  {
    id: "SLOP-P0-07",
    alias: "no-ts-ignore",
    severity: "error",
    message: "@ts-ignore or @ts-expect-error directive without explicit justification comment.",
    remediation: "Provide a justification comment on the same line, e.g. '// @ts-expect-error: legacy port compatibility'.",
    pattern: /@ts-(ignore|expect-error)\b/,
    refine: (line: string): boolean => {
      // Allow if there is a colon or explanatory text following directive
      if (/@ts-(ignore|expect-error)\s*:\s*\S+/.test(line)) return false;
      if (/@ts-(ignore|expect-error)\s+-\s+\S+/.test(line)) return false;
      return true;
    },
  },
  {
    id: "SLOP-P1-01",
    alias: "no-as-never",
    severity: "warn",
    message: "Type cast 'as never' bypass.",
    remediation: "Verify discriminated union types or use an explicit type guard instead of 'as never'.",
    pattern: /\bas\s+never\b/,
  },
  {
    id: "SLOP-P1-02",
    alias: "no-unknown-chain",
    severity: "warn",
    message: "Double type cast 'as unknown as T'.",
    remediation: "Validate inputs with type guards or schemas rather than double casting through 'unknown'.",
    pattern: /\bas\s+unknown\s+as\b/,
  },
  {
    id: "SLOP-P1-03",
    alias: "no-explicit-any",
    severity: "warn",
    message: "Explicit 'any' type annotation in public method or property signature.",
    remediation: "Replace 'any' with 'unknown' combined with type narrowing or a concrete interface.",
    pattern: /:\s*any\b/,
    refine: (line: string): boolean => {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
      return true;
    },
  },
  {
    id: "SLOP-P1-04",
    alias: "secrets-suspect",
    severity: "warn",
    message: "Hardcoded secret or API key string literal detected.",
    remediation: "Load secret credentials dynamically from environment variables.",
    pattern: /(api[_-]?key|secret|private[_-]?key)\s*[:=]\s*["'][^"']{8,}["']/i,
  },
];
