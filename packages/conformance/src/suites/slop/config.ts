/**
 * @mosaix/conformance — Slop Checker Configuration Loader (PRD-0012)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { SlopRule, SLOP_RULES, SlopSeverity } from "./rules.js";
import { SlopExecutionError, SlopScopeName } from "./scope.js";

export interface SlopAllowEntry {
  ruleId: string;
  path: string;
  reason?: string;
}

export interface SlopConfigFile {
  version?: number;
  scopes?: SlopScopeName[];
  strict?: boolean;
  base?: string;
  rules?: Record<string, "off" | "warn" | "error">;
  allow?: SlopAllowEntry[];
}

export interface ResolvedSlopConfig {
  version: number;
  scopes: SlopScopeName[];
  strict: boolean;
  base: string;
  rules: SlopRule[];
  globalAllow: SlopAllowEntry[];
}

export function loadSlopConfig(rootDir: string = process.cwd()): ResolvedSlopConfig {
  const configPath = path.join(rootDir, ".slop.json");

  let rawConfig: SlopConfigFile = {};
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, "utf-8");
      rawConfig = JSON.parse(content) as SlopConfigFile;
    } catch (err) {
      throw new SlopExecutionError(
        `Invalid .slop.json configuration at '${configPath}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  const validRuleIds = new Set(SLOP_RULES.map((r) => r.id));

  // Validate rule overrides in config
  if (rawConfig.rules) {
    for (const ruleId of Object.keys(rawConfig.rules)) {
      if (!validRuleIds.has(ruleId)) {
        throw new SlopExecutionError(
          `Invalid .slop.json configuration: unknown rule ID '${ruleId}'.`
        );
      }
    }
  }

  // Derive resolved rules list
  const activeRules: SlopRule[] = [];
  for (const baseRule of SLOP_RULES) {
    const override = rawConfig.rules?.[baseRule.id];
    if (override === "off") continue;

    const activeRule: SlopRule = { ...baseRule };
    if (override === "warn" || override === "error") {
      activeRule.severity = override;
    }
    activeRules.push(activeRule);
  }

  return {
    version: rawConfig.version ?? 1,
    scopes: rawConfig.scopes ?? ["code"],
    strict: rawConfig.strict ?? false,
    base: rawConfig.base ?? "origin/main",
    rules: activeRules,
    globalAllow: rawConfig.allow ?? [],
  };
}
