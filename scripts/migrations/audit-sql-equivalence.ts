/**
 * scripts/migrations/audit-sql-equivalence.ts — non-regression audit of the
 * generated SQL.
 *
 * The TypeScript native migrations must generate the same schema as the
 * historical SQL strings they replaced. The audit compares them statement
 * by statement, on the *structure* of the statements — the equivalences
 * that are normalized:
 *
 *  - the literals: `$$os$$` (historical) vs a bound parameter (DSL);
 *  - the identifier quoting: `"table"` vs `table`;
 *  - the whitespace and the redundant parentheses;
 *  - the type synonyms: `TIMESTAMPTZ` vs `TIMESTAMP WITH TIME ZONE`;
 *  - the function names: `now()` vs `NOW()`;
 *  - `PRIMARY KEY` implies `NOT NULL`;
 *  - `IF EXISTS` on a dropped constraint;
 *  - `CASCADE` on a dropped table (implicit in the historical SQL);
 *  - the number of values of an `IN (…)` list (the historical SQL
 *    interpolated a runtime vocabulary).
 *
 * The migrations that did not exist in the historical revision (the ones
 * created by this conversion) are skipped: they have no reference.
 *
 * Usage: `pnpm audit:migrations` (exit code 1 on any divergence).
 */
import { execSync } from "node:child_process";
import {
  MigrationCompiler,
  PostgresGrammar,
  SQLiteGrammar,
} from "../../packages/migrations/src/index.js";
import type { Migration } from "../../packages/migrations/src/index.js";
import { HISTORICAL_REF } from "./historical-ref.js";

const RUNTIME = {
  dialect: "postgres" as const,
  capabilities: {
    transactions: true,
    lock: { distributed: false, processSafe: true, runtimeSafe: true },
  },
};

/** The tokens of a statement, with the insignificant ones removed. */
function tokens(sql: string): string[] {
  return sql
    .replace(/\$\$[^$]*\$\$/g, " LIT ")
    .replace(/'(?:[^']|'')*'/g, " LIT ")
    .replace(/\$\{[^}]*\}/g, " LIT ")
    .replace(/\?/g, " LIT ")
    .replace(/"/g, "")
    .replace(/\bnow\(\)/gi, "NOW()")
    .replace(/\bCURRENT_TIMESTAMP\b/gi, "NOW()")
    .replace(/\bTIMESTAMPTZ\b/gi, "TIMESTAMP WITH TIME ZONE")
    .replace(/\bTIMESTAMP\s+WITH\s+TIME\s+ZONE\b/gi, "TIMESTAMP WITH TIME ZONE")
    .replace(/\bBOOL\b/gi, "BOOLEAN")
    .replace(/\s+CASCADE\b/g, "")
    .replace(/\s+FOR\s+EACH\s+ROW\b/g, "")
    .toUpperCase()
    .split(/[^A-Z0-9_$?]+/)
    .filter((token) => token.length > 0);
}

/** The canonical form of a statement. */
function canonical(sql: string): string {
  let out = tokens(sql).join(" ");
  // A PRIMARY KEY implies NOT NULL.
  out = out.replace(/PRIMARY KEY NOT NULL/g, "PRIMARY KEY");
  // The `IF EXISTS` of the table is the historical default for a dropped
  // constraint.
  out = out.replace(/ALTER TABLE IF EXISTS /g, "ALTER TABLE ");
  // A nullable column: the DSL omits the `NULL` keyword.
  out = out.replace(/ TEXT NULL\b/g, " TEXT");
  // The `IN (…)` list of a constraint: the historical SQL interpolated a
  // runtime vocabulary, the DSL binds the values.
  out = out.replace(/IN \( LIT ( , LIT )*\)/g, "IN ( LIT )");
  out = out.replace(/IN \(LIT( LIT)*\)/g, "IN (LIT)");
  // The redundant parentheses are removed below: the list is then compared
  // without them.
  out = out.replace(/IN LIT( LIT)*/g, "IN LIT");
  // The `SELECT 1` of an existence probe.
  out = out.replace(
    /NOT EXISTS \( SELECT LIT FROM/g,
    "NOT EXISTS ( SELECT 1 FROM",
  );
  // The qualified name of a referenced table.
  out = out.replace(/REFERENCES ([A-Z_]+) ([A-Z_]+)/g, "REFERENCES $2");
  // The redundant parentheses of an expression.
  let previous = "";
  while (previous !== out) {
    previous = out;
    out = out.replace(/\( ([^()]*?) \)/g, " $1 ");
  }
  return out.replace(/\s+/g, " ").trim();
}

/** The multiset of the canonical statements. */
function bag(statements: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const statement of statements) {
    const key = canonical(statement);
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

async function compiled(
  migration: Migration,
  dialect: "sqlite" | "postgres",
): Promise<string[]> {
  const compiler = new MigrationCompiler(
    dialect === "postgres" ? new PostgresGrammar() : new SQLiteGrammar(),
    dialect,
    dialect === "postgres" ? RUNTIME : { ...RUNTIME, dialect: "sqlite" },
  );
  const up = await compiler.compileUpAsync(migration);
  const down = await compiler.compileDownAsync(migration);
  return [
    ...up.statements.map((statement) => statement.sql),
    ...(down?.statements ?? []).map((statement) => statement.sql),
  ];
}

const SPECS: readonly { file: string; dialect: "sqlite" | "postgres" }[] = [
  {
    file: "apps/booking/src/infrastructure/migrations/20260926140000_harden_booking.ts",
    dialect: "postgres",
  },
  {
    file: "apps/commerce/src/infrastructure/migrations/20260926110000_harden_commerce.ts",
    dialect: "postgres",
  },
  {
    file: "apps/commerce/src/infrastructure/migrations/20261013000000_order_pending_payment.ts",
    dialect: "postgres",
  },
  {
    file: "apps/portfolio/src/infrastructure/migrations/20260925130000_harden_data_integrity.ts",
    dialect: "postgres",
  },
  {
    file: "apps/portfolio/src/infrastructure/migrations/20261010080000_normalize_pim_to_dedicated_tables.ts",
    dialect: "postgres",
  },
  {
    file: "apps/portfolio/src/infrastructure/migrations/20261010100000_normalize_pim_fixes.ts",
    dialect: "postgres",
  },
  {
    file: "apps/portfolio/src/infrastructure/migrations/20261013010000_proposal_approval_fields.ts",
    dialect: "postgres",
  },
  {
    file: "apps/portfolio/src/infrastructure/migrations/20261108120000_add_tenant_id_to_portfolio.ts",
    dialect: "postgres",
  },
  {
    file: "apps/solidarity/src/infrastructure/migrations/20261010090000_add_solidarity_allocations.ts",
    dialect: "postgres",
  },
  {
    file: "apps/spaces/src/infrastructure/migrations/20260926150000_harden_spaces.ts",
    dialect: "postgres",
  },
  {
    file: "apps/citadelle/src/infrastructure/migrations/20261108130000_create_mfa_secrets.ts",
    dialect: "postgres",
  },
  {
    file: "src/shell/database/minimal-core-migration.ts",
    dialect: "sqlite",
  },
  {
    file: "src/shell/database/mobile-bridge-migration.ts",
    dialect: "sqlite",
  },
];

let checked = 0;
let skipped = 0;
let divergences = 0;

for (const spec of SPECS) {
  let historical: string;
  try {
    historical = execSync(`git show ${HISTORICAL_REF}:${spec.file}`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    skipped += 1;
    continue;
  }

  // The historical statements: the `up` section and the `down` section.
  const upSection =
    /const\s+upStatements\s*:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/.exec(
      historical,
    );
  const downSection =
    /const\s+downStatements\s*:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/.exec(
      historical,
    );

  const expected: string[] = [];
  if (upSection) {
    for (const match of upSection[1]!.matchAll(/`([\s\S]*?)`/g)) {
      expected.push(match[1]!);
    }
  } else {
    const content = /content:\s*`([\s\S]*?)`/.exec(historical);
    if (content) {
      for (const statement of content[1]!.split(/;\s*\n/)) {
        const trimmed = statement.trim();
        if (trimmed.length > 0) expected.push(`${trimmed};`);
      }
    }
  }
  if (downSection) {
    for (const match of downSection[1]!.matchAll(/`([\s\S]*?)`/g)) {
      expected.push(match[1]!);
    }
  }

  const filtered = expected.filter((sql) =>
    /^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|SELECT)/i.test(sql.trim()),
  );
  if (filtered.length === 0) {
    skipped += 1;
    continue;
  }

  const module = (await import(`../../${spec.file}`)) as {
    migration?: Migration;
    default?: Migration;
  };
  const migration = module.migration ?? module.default;
  if (migration === undefined) {
    skipped += 1;
    continue;
  }

  const actual = await compiled(migration, spec.dialect);
  const expectedBag = bag(filtered);
  const actualBag = bag(actual);

  const missing: string[] = [];
  for (const [key, count] of expectedBag) {
    const got = actualBag.get(key) ?? 0;
    if (got < count) {
      missing.push(`${key} (historique x${count}, genere x${got})`);
    }
  }
  const extra: string[] = [];
  for (const [key, count] of actualBag) {
    const got = expectedBag.get(key) ?? 0;
    if (got < count) {
      extra.push(`${key} (genere x${count}, historique x${got})`);
    }
  }

  checked += 1;
  if (missing.length === 0 && extra.length === 0) {
    console.log(`[sql] OK       ${spec.file}`);
    continue;
  }

  divergences += missing.length + extra.length;
  console.error(`[sql] DIFF     ${spec.file}`);
  for (const statement of missing) {
    console.error(`   manquant : ${statement.slice(0, 210)}`);
  }
  for (const statement of extra) {
    console.error(`   en trop  : ${statement.slice(0, 210)}`);
  }
}

console.log(
  `[sql] ${checked} migration(s) comparée(s), ${skipped} ignorée(s), ${divergences} divergence(s).`,
);
if (divergences > 0) {
  process.exitCode = 1;
}
