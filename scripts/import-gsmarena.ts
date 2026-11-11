/**
 * scripts/import-gsmarena.ts — Import GSMArena -> Portfolio PIM via l'outil MCP.
 *
 * Usage:
 *   pnpm tsx scripts/import-gsmarena.ts --dry-run --limit 3
 *   pnpm tsx scripts/import-gsmarena.ts [--urls <fichier>] [--delay 3000] [--db-url <url>]
 *
 * - Fetche chaque fiche (User-Agent navigateur, ~20 pages/min max + jitter,
 *   requetes strictement sequentielles, Retry-After honore, arret sur 403
 *   ou 429 repetes).
 * - Parse generique du tableau de specs (sections/ttl/nfo). Ignore les
 *   sections "Our Tests"/"EU LABEL", les lignes prix et les blocs prix
 *   partenaires.
 * - Construit un payload `portfolio_vendable_propose` : type Product,
 *   contenu FR redige a partir des faits (jamais copie), attributs cibles,
 *   specifications integrales, variantes memoire/RAM deduites, options
 *   (coloris, poids) deducees, media bigpic, sourceUrl tracee.
 * - Prix/stock/disponibilite : JAMAIS importes (frontiere PIM/Commerce).
 * - Idempotent : reference existante -> skip. Tout est cree en Draft.
 */
import * as fs from "node:fs";
import type { MCPToolRegistry } from "@mosaix/mcp";
import type { PortfolioBACClient } from "@mosaix/mcp";
// VendableRepository is loaded dynamically at runtime via workspace loader;
// the @apps/portfolio path alias is not configured in tsconfig.
// Structural interface mirroring VendableRepository (domain port).
type VendableRepository = {
  save(v: unknown): Promise<void> | void;
  findById(id: string): Promise<unknown> | unknown;
  findByReference(ref: string): Promise<unknown> | unknown;
  findAll(): Promise<unknown[]> | unknown[];
  delete(id: string): Promise<void> | void;
};
import type { DatabasePort } from "@mosaix/ports-database";

/**
 * Chargement resilient des modules workspace (package construit ou sources).
 * Meme pattern que le wiring MCP stdio : `dist` peut ne pas exister.
 */
async function loadWorkspaceModules(): Promise<{
  MCPToolRegistry: new () => MCPToolRegistry;
  registerPortfolioTools: (
    tools: MCPToolRegistry,
    client?: PortfolioBACClient,
  ) => void;
  createPortfolioBACClient: (service: {
    search(criteria: Record<string, unknown>): Promise<unknown[]>;
    findVendable(id: string): Promise<unknown>;
    createVendable(draft: unknown): Promise<unknown>;
  }) => PortfolioBACClient;
  PortfolioService: new (repository: VendableRepository) => {
    search(
      criteria: Record<string, unknown>,
    ): Promise<
      Array<{
        identity: { reference: string };
      }>
    >;
  };
  PostgresVendableRepository: new (
    databasePort: DatabasePort,
  ) => VendableRepository;
  createPostgresDatabasePort: (url: string) => DatabasePort;
}> {
  const candidates = [
    ["@mosaix/mcp", "../packages/mcp/src/index.ts"],
    ["@apps/portfolio", "../apps/portfolio/src/index.ts"],
    [
      "@mosaix/adapter-database-postgres",
      "../packages/adapters/database-postgres/src/index.ts",
    ],
  ] as const;
  const loaded: Record<string, unknown> = {};
  for (const [pkg, fallback] of candidates) {
    try {
      loaded[pkg] = await import(pkg);
    } catch {
      loaded[pkg] = await import(fallback);
    }
  }
  const mcp = loaded["@mosaix/mcp"] as Record<string, never>;
  const portfolio = loaded["@apps/portfolio"] as Record<string, never>;
  const adapter = loaded["@mosaix/adapter-database-postgres"] as Record<
    string,
    never
  >;
  const need = (
    mod: Record<string, never>,
    name: string,
    pkg: string,
  ): never => {
    const value = mod[name];
    if (value === undefined || value === null) {
      throw new Error(`export ${name} introuvable dans ${pkg}`);
    }
    return value;
  };
  return {
    MCPToolRegistry: need(mcp, "MCPToolRegistry", "@mosaix/mcp"),
    registerPortfolioTools: need(mcp, "registerPortfolioTools", "@mosaix/mcp"),
    createPortfolioBACClient: need(
      mcp,
      "createPortfolioBACClient",
      "@mosaix/mcp",
    ),
    PortfolioService: need(portfolio, "PortfolioService", "@apps/portfolio"),
    PostgresVendableRepository: need(
      portfolio,
      "PostgresVendableRepository",
      "@apps/portfolio",
    ),
    createPostgresDatabasePort: need(
      adapter,
      "createPostgresDatabasePort",
      "@mosaix/adapter-database-postgres",
    ),
  };
}

const SKIP_URLS = new Set([
  // Deja importe (XIAOMI-18-PRO-MAX-5G) : la reference derivee collisionnerait.
  "https://www.gsmarena.com/xiaomi_18_pro_max_5g-14958.php",
]);

const DEFAULT_URLS = [
  "https://www.gsmarena.com/xiaomi_18_pro_5g-14959.php",
  "https://www.gsmarena.com/xiaomi_pad_9_pro-14960.php",
  "https://www.gsmarena.com/xiaomi_pad_9-14961.php",
  "https://www.gsmarena.com/xiaomi_poco_c95_pro-14933.php",
  "https://www.gsmarena.com/xiaomi_18_fold_5g-14931.php",
  "https://www.gsmarena.com/xiaomi_pad_9_pro_max-14932.php",
  "https://www.gsmarena.com/xiaomi_poco_x8_power_5g-14912.php",
  "https://www.gsmarena.com/xiaomi_poco_x8_5g-14911.php",
  "https://www.gsmarena.com/xiaomi_poco_f9_ultra_5g-14876.php",
  "https://www.gsmarena.com/xiaomi_poco_f9_pro_5g-14877.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_17_pro_max_5g-14845.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_17_pro_5g-14844.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_17_5g-14846.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_17-14847.php",
  "https://www.gsmarena.com/xiaomi_redmi_17c_5g-14866.php",
  "https://www.gsmarena.com/xiaomi_redmi_watch_6_lite-14821.php",
  "https://www.gsmarena.com/xiaomi_redmi_watch_6_active-14820.php",
  "https://www.gsmarena.com/xiaomi_poco_m8x_5g-14879.php",
  "https://www.gsmarena.com/xiaomi_redmi_m100_5g-14882.php",
  "https://www.gsmarena.com/xiaomi_redmi_k100_pro_max_5g-14865.php",
  "https://www.gsmarena.com/xiaomi_redmi_k100_pro_5g-14715.php",
  "https://www.gsmarena.com/xiaomi_redmi_17_5g-14869.php",
  "https://www.gsmarena.com/xiaomi_redmi_17-14807.php",
  "https://www.gsmarena.com/xiaomi_poco_m8_power_5g-14804.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_17_pro_5g_(china)-14797.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_17_5g_(china)-14798.php",
  "https://www.gsmarena.com/xiaomi_redmi_k90_ultra_5g-14757.php",
  "https://www.gsmarena.com/xiaomi_redmi_17c_(china)-14750.php",
  "https://www.gsmarena.com/xiaomi_17t_pro_5g-14651.php",
  "https://www.gsmarena.com/xiaomi_17t_5g-14652.php",
  "https://www.gsmarena.com/xiaomi_watch_s5-14696.php",
  "https://www.gsmarena.com/xiaomi_17_max_5g-14667.php",
  "https://www.gsmarena.com/xiaomi_poco_pad_c1-14682.php",
  "https://www.gsmarena.com/xiaomi_black_shark_pad_se-14777.php",
  "https://www.gsmarena.com/xiaomi_poco_c81_pro-14635.php",
  "https://www.gsmarena.com/xiaomi_poco_c81-14626.php",
  "https://www.gsmarena.com/xiaomi_poco_c81x-14627.php",
  "https://www.gsmarena.com/xiaomi_redmi_k90_max_5g-14618.php",
  "https://www.gsmarena.com/xiaomi_redmi_k_pad_2-14625.php",
  "https://www.gsmarena.com/xiaomi_redmi_pad_2_9_7-14636.php",
  "https://www.gsmarena.com/xiaomi_redmi_a7_pro_5g-14616.php",
  "https://www.gsmarena.com/xiaomi_redmi_a7-14623.php",
  "https://www.gsmarena.com/xiaomi_poco_m8s_5g-14615.php",
  "https://www.gsmarena.com/xiaomi_redmi_r70m_5g-14600.php",
  "https://www.gsmarena.com/xiaomi_redmi_r70_5g-14598.php",
  "https://www.gsmarena.com/xiaomi_redmi_note_15_special_edition_5g-14571.php",
  "https://www.gsmarena.com/xiaomi_redmi_a7_pro-14463.php",
  "https://www.gsmarena.com/xiaomi_redmi_15a_5g-14565.php",
  "https://www.gsmarena.com/xiaomi_poco_x8_pro_max_5g-14507.php",
];

interface SpecRow {
  label: string;
  value: string;
}
interface SpecSection {
  section: string;
  rows: SpecRow[];
}
interface ParsedPhone {
  url: string;
  slug: string;
  name: string;
  image: string;
  year: string;
  sections: SpecSection[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;|&#160;|&thinsp;/g, " ")
    .replace(/&Prime;|&#8243;/g, '"')
    .replace(/&prime;|&#8242;/g, "'")
    .replace(/&deg;|&#176;/g, "°")
    .replace(/&ndash;|&#8211;/g, "-")
    .replace(/&mdash;|&#8212;/g, "-")
    .replace(/&hellip;|&#8230;/g, "...")
    .replace(/&[a-zA-Z]+;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(
    s
      .replace(/<br\s*\/?>/gi, " | ")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function cleanLabel(s: string): string {
  return decodeEntities(
    s
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

const SKIP_SECTIONS = new Set(["our tests", "eu label"]);

function slugFromUrl(url: string): string {
  return url.match(/\/([^/]+)\.php(?:[?#]|$)/)?.[1] ?? "unknown";
}

function referenceForSlug(slug: string): string {
  return slug
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parsePage(html: string, url: string): ParsedPhone {
  const slug = slugFromUrl(url);
  const h1 = html.match(
    /<h1 class="specs-phone-name-title"[^>]*>([^<]+)<\/h1>/,
  );
  const titleTag = html.match(/<title>([^<]+)<\/title>/);
  const name = (
    h1?.[1] ??
    titleTag?.[1]?.replace(/\s*-\s*Full.*specifications\s*$/i, "") ??
    slug
  ).trim();
  const histImg = html.match(/HISTORY_ITEM_IMAGE\s*=\s*"([^"]+)"/);
  const bigpic = html.match(
    /https:\/\/fdn2\.gsmarena\.com\/vv\/bigpic\/[^"' )]+/,
  );
  const image = histImg?.[1] ?? bigpic?.[0] ?? "";

  const specsZone = html.split('<div id="specs-list">')[1]?.split('<p class="note">')[0] ?? html;
  const sections: SpecSection[] = [];
  let current: SpecSection | null = null;
  const tokenRe =
    /<th[^>]*scope="row"[^>]*>([^<]*)<\/th>|<td class="ttl">(.*?)<\/td>\s*<td class="nfo"([^>]*)>(.*?)<\/td>/gis;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(specsZone)) !== null) {
    if (m[1] !== undefined) {
      const section = cleanLabel(m[1]);
      if (!section) continue;
      current = { section, rows: [] };
      sections.push(current);
    } else {
      const label = cleanLabel(m[2] ?? "");
      const nfoAttrs = m[3] ?? "";
      const specAttr = nfoAttrs.match(/data-spec="([^"]+)"/)?.[1] ?? "";
      const value = stripTags(m[4] ?? "");
      if (!current) {
        current = { section: "General", rows: [] };
        sections.push(current);
      }
      if (!value || /^price$/i.test(label)) continue;
      const finalLabel =
        label ||
        specAttr
          .replace(/^(net|body|display|memory|battery)/, "")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .trim() ||
        "Details";
      current.rows.push({ label: finalLabel, value });
    }
  }
  const kept = sections.filter(
    (s) => !SKIP_SECTIONS.has(s.section.toLowerCase()) && s.rows.length > 0,
  );
  const announced =
    kept
      .find((s) => s.section.toLowerCase() === "launch")
      ?.rows.find((r) => /announc/i.test(r.label))?.value ?? "";
  const year = announced.match(/(\d{4})/)?.[1] ?? "";
  return { url, slug, name, image, year, sections: kept };
}

function sectionMap(p: ParsedPhone): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const s of p.sections) {
    const key = s.section
      .toLowerCase()
      .replace(/[^a-z]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const rows = new Map<string, string>();
    for (const r of s.rows) {
      const k = r.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      if (k && !rows.has(k)) rows.set(k, r.value);
    }
    const existing = out.get(key);
    if (existing) {
      for (const [k, v] of rows) if (!existing.has(k)) existing.set(k, v);
    } else {
      out.set(key, rows);
    }
  }
  return out;
}

function firstModule(value: string | undefined): string {
  if (!value) return "";
  return value.split(" | ")[0]?.trim() ?? "";
}

export function parseMemoryConfigs(
  internal: string,
): Array<{ storageGb: string; ramGb: string }> {
  const out: Array<{ storageGb: string; ramGb: string }> = [];
  for (const part of internal.split(",")) {
    const m = part.match(
      /(\d+(?:\.\d+)?)\s*(GB|TB|MB)\s+(\d+)\s*GB\s*RAM/i,
    );
    if (!m) continue;
    const size = Number(m[1]);
    const unit = m[2]?.toUpperCase();
    const storageGb = String(
      unit === "TB" ? size * 1024 : unit === "MB" ? Math.max(1, Math.round(size / 1024)) : size,
    );
    out.push({ storageGb, ramGb: m[3] as string });
  }
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.storageGb}/${c.ramGb}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function fmtStorage(gb: string): string {
  const n = Number(gb);
  if (Number.isFinite(n) && n >= 1024 && n % 1024 === 0) return `${n / 1024} To`;
  return `${gb} Go`;
}

function categoryFor(p: ParsedPhone): string {
  const hay = `${p.slug} ${p.name}`.toLowerCase();
  if (/watch/.test(hay)) return "wearables";
  if (/pad|tablet/.test(hay)) return "tablets";
  return "smartphones";
}

function tagsFor(p: ParsedPhone, category: string): string[] {
  const hay = `${p.slug} ${p.name}`.toLowerCase();
  const tags = ["xiaomi"];
  if (/redmi/.test(hay)) tags.push("redmi");
  if (/poco/.test(hay)) tags.push("poco");
  if (/black.shark|blackshark/.test(hay.replace(/[-_]/g, "")))
    tags.push("black_shark");
  tags.push(
    category === "wearables"
      ? "smartwatch"
      : category === "tablets"
        ? "tablet"
        : "smartphone",
  );
  tags.push(/5g/.test(hay) ? "5g" : "4g");
  return [...new Set(tags)];
}

export interface ProposeArgs {
  reference: string;
  name: string;
  type: string;
  description: string;
  category: string;
  tags: string[];
  brand: string;
  language: string;
  attributes: Record<string, unknown>;
  specifications: Record<string, unknown>;
  mediaUrls: string[];
  variants: Array<{
    name: string;
    sku: string;
    attributes?: Record<string, string>;
  }>;
  sourceUrl: string;
}

export function buildProposeInput(p: ParsedPhone): ProposeArgs {
  const map = sectionMap(p);
  const get = (section: string, ...keys: string[]): string => {
    const rows = map.get(section);
    if (!rows) return "";
    for (const k of keys) {
      const v = rows.get(k);
      if (v) return v;
    }
    return "";
  };
  const reference = referenceForSlug(p.slug);
  const category = categoryFor(p);
  const internal = get("memory", "internal");
  const configs = parseMemoryConfigs(internal);
  const colorsRaw = get("misc", "colors");
  const colors = colorsRaw
    ? [...new Set(colorsRaw.split(",").map((c) => c.trim()).filter(Boolean))]
    : [];
  const weightRaw =
    get("body", "weight").split("(")[0]?.trim() ?? "";
  const batteryRaw = get("battery", "type");
  const batteryMah = batteryRaw.match(/([\d\s]+)\s*mAh/i)?.[1]?.replace(/\s+/g, "") ?? "";
  const os = get("platform", "os");
  const chipset = get("platform", "chipset");
  const displaySize = get("display", "size").match(/([\d.]+)\s*inches/)?.[1] ?? "";
  const displayType = get("display", "type").split(",")[0]?.trim() ?? "";
  const model = get("misc", "models").split(/[,\s]+/)[0] ?? "";

  const facts: string[] = [];
  if (displaySize) facts.push(`ecran ${displaySize} pouces ${displayType}`.trim());
  if (chipset) facts.push(chipset);
  if (internal) facts.push(`memoire ${internal}`);
  const cam = firstModule(get("main_camera", "triple", "quad", "dual", "single"));
  if (cam) facts.push(`photo ${cam}`);
  else {
    const selfie = firstModule(get("selfie_camera", "single", "dual"));
    if (selfie) facts.push(`selfie ${selfie}`);
  }
  if (batteryRaw) facts.push(`batterie ${batteryRaw}`);
  if (os) facts.push(os);
  const yearBit = p.year ? ` (${p.year})` : "";
  const description =
    `${p.name}${yearBit} : ${facts.join(" ; ")}. ` +
    `Fiche descriptive PIM : declinaisons en variantes, sans prix ni disponibilite.`;

  const attributes: Record<string, unknown> = { brand: "Xiaomi" };
  if (model) attributes["model"] = model;
  if (os) attributes["os"] = os;
  if (chipset) attributes["chipset"] = chipset;
  if (batteryMah) attributes["battery_mAh"] = Number(batteryMah);
  if (weightRaw) attributes["weight"] = weightRaw;
  if (displaySize) attributes["display_size_inch"] = Number(displaySize);

  const specifications: Record<string, unknown> = {};
  for (const [section, rows] of map) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of rows) obj[k] = v;
    if (Object.keys(obj).length > 0) specifications[section] = obj;
  }

  const options: Record<string, unknown> = {};
  if (configs.length > 0) {
    options["storage_ram"] = {
      label: "Stockage / RAM",
      values: configs.map((c) => `${c.storageGb}GB ${c.ramGb}GB RAM`),
      source: "gsmarena:Memory/Internal",
      modeling: "variantes (SKU dedies)",
    };
  }
  if (colors.length > 0) {
    options["color"] = {
      label: "Coloris",
      values: colors,
      source: "gsmarena:Misc/Colors",
      modeling: "options (aucun SKU par coloris sur la source)",
    };
  }
  const weightParts = weightRaw.includes(" or ")
    ? weightRaw.split(" or ").map((w) => w.trim()).filter(Boolean)
    : [];
  if (weightParts.length > 1) {
    options["weight"] = {
      label: "Poids",
      values: weightParts,
      source: "gsmarena:Body/Weight",
      note: "Le critere distinguant les poids n'est pas precise sur la fiche source — non modelise en variantes.",
    };
  }
  if (Object.keys(options).length > 0) attributes["options"] = options;

  const refBase = reference.replace(/-\d+$/, "");
  const variants = configs.map((c) => ({
    name: `${fmtStorage(c.storageGb)} / ${c.ramGb} Go RAM`,
    sku: `${refBase}-${c.storageGb}-${c.ramGb}`.slice(0, 64),
    attributes: {
      storage_gb: c.storageGb,
      ram_gb: c.ramGb,
    },
  }));

  return {
    reference,
    name: p.name,
    type: "Product",
    description: description.slice(0, 2000),
    category,
    tags: tagsFor(p, category),
    brand: "Xiaomi",
    language: "fr",
    attributes,
    specifications,
    mediaUrls: p.image.startsWith("http") ? [p.image] : [],
    variants,
    sourceUrl: p.url,
  };
}

// ---------- execution ----------

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]?.startsWith("--")) {
    return process.argv[i + 1];
  }
  return fallback;
}
const has = (name: string): boolean => process.argv.includes(name);

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchPage(url: string): Promise<string> {
  let lastStatus = 0;
  let sawRateLimit = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(25000),
    });
    lastStatus = res.status;
    if (res.status === 403) {
      throw new Error(`HTTP 403 anti-bot sur ${url} (arret)`);
    }
    if (res.status === 429 || res.status >= 500) {
      // Politesse : honorer Retry-After quand le serveur l'envoie.
      sawRateLimit = sawRateLimit || res.status === 429;
      const retryAfter = res.headers.get("retry-after");
      let waitMs = 5000 * (attempt + 1);
      if (retryAfter) {
        const secs = Number(retryAfter);
        if (Number.isFinite(secs)) waitMs = Math.min(secs * 1000, 60000);
        else {
          const dateMs = Date.parse(retryAfter) - Date.now();
          if (Number.isFinite(dateMs) && dateMs > 0)
            waitMs = Math.min(dateMs, 60000);
        }
      }
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    const text = await res.text();
    if (!text.includes("specs-list") || !text.includes("specs-phone-name-title")) {
      throw new Error(`page inattendue (pas de specs) sur ${url}`);
    }
    return text;
  }
  const err = new Error(`HTTP ${lastStatus} persistant sur ${url}`);
  (err as { rateLimited?: boolean }).rateLimited =
    lastStatus === 429 || sawRateLimit;
  throw err;
}

function resolveDbUrl(): string {
  const fromEnv =
    process.env["MOSAIX_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (fromEnv) return fromEnv;
  try {
    const envFile = fs.readFileSync(".env", "utf8");
    const m = envFile.match(/^MOSAIX_DATABASE_URL=(.+)$/m);
    if (m?.[1]) return m[1].trim();
  } catch {
    // ignore
  }
  return "postgresql://mosaix:mosaix@localhost:5432/mosaix_dev";
}

async function main(): Promise<void> {
  const dryRun = has("--dry-run");
  const limit = Number(arg("--limit", "0")) || 0;
  // Debit volontairement bas : ~20 pages/min max + jitter (pas de rafale,
  // requetes strictement sequentielles). Ne pas descendre sous 2000 ms.
  const delayMs = Math.max(Number(arg("--delay", "3000")) || 3000, 2000);
  const urlsFile = arg("--urls");
  let urls = urlsFile
    ? fs
        .readFileSync(urlsFile, "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("http"))
    : [...DEFAULT_URLS];
  urls = urls.filter((u) => !SKIP_URLS.has(u));
  if (limit > 0) urls = urls.slice(0, limit);

  console.log(`URLs: ${urls.length} (dryRun=${dryRun})`);

  let propose:
    | ((input: unknown) => Promise<unknown>)
    | undefined;
  let search: ((input: unknown) => Promise<unknown>) | undefined;
  let read: ((input: unknown) => Promise<unknown>) | undefined;
  if (!dryRun) {
    // Meme chemin que le transport MCP HTTP : validation de l'outil
    // `portfolio_vendable_propose` + persistance Postgres.
    const {
      MCPToolRegistry: Registry,
      registerPortfolioTools: registerTools,
      createPortfolioBACClient: createClient,
      PortfolioService: Service,
      PostgresVendableRepository: Repository,
      createPostgresDatabasePort: createPort,
    } = await loadWorkspaceModules();
    const db = createPort(resolveDbUrl());
    const service = new Service(new Repository(db) as never);
    const client: PortfolioBACClient = createClient(service as never);
    const tools = new Registry();
    registerTools(tools, client);
    const proposeTool = tools.getTool("portfolio_vendable_propose");
    const searchTool = tools.getTool("portfolio_vendable_search");
    const readTool = tools.getTool("portfolio_vendable_read");
    if (!proposeTool || !searchTool || !readTool) {
      throw new Error("outils MCP portfolio non enregistres");
    }
    propose = (input: unknown) => proposeTool.handler(input);
    search = (input: unknown) => searchTool.handler(input);
    read = (input: unknown) => readTool.handler(input).catch(() => undefined);
  }

  let created = 0;
  let skipped = 0;
  let consecutiveRateLimited = 0;
  const failed: string[] = [];
  // Import volontairement sequentiel (politesse anti-bot : ~20 pages/min max).
  for (const [i, url] of urls.entries()) {
    try {
      if (!dryRun) {
        // Skip sans fetch : la reference derive de l'URL, controlee via
        // l'outil MCP read (aucun appel externe).
        const probeRef = referenceForSlug(slugFromUrl(url));
        const existing = (await read?.({ id: probeRef })) as
          | { reference?: string }
          | undefined;
        if (existing && typeof existing.reference === "string") {
          skipped += 1;
          console.log(`SKIP (doublon, sans fetch) ${probeRef}`);
          continue;
        }
      }
      const html = await fetchPage(url);
      consecutiveRateLimited = 0;
      const parsed = parsePage(html, url);
      const input = buildProposeInput(parsed);
      if (dryRun) {
        console.log(`--- DRY ${i + 1}/${urls.length} ${input.reference}`);
        console.log(
          JSON.stringify(
            {
              name: input.name,
              category: input.category,
              tags: input.tags,
              variants: input.variants.length,
              specs: Object.keys(input.specifications),
              media: input.mediaUrls.length,
              description: input.description.slice(0, 180),
            },
            null,
            1,
          ),
        );
      } else {
        try {
          await propose?.(input);
          created += 1;
          console.log(`OK ${input.reference} (${input.variants.length} variantes)`);
        } catch (err) {
          if (
            err instanceof Error &&
            /already exists/.test(err.message)
          ) {
            skipped += 1;
            console.log(`SKIP (doublon) ${input.reference}`);
          } else {
            throw err;
          }
        }
      }
    } catch (err) {
      failed.push(url);
      console.log(
        `ECHEC ${url} : ${err instanceof Error ? err.message : String(err)}`,
      );
      if (err instanceof Error && /403/.test(err.message)) {
        throw new Error(err.message, { cause: err });
      }
      // Trop de 429 d'affilee : on arrete tout au lieu de marteler.
      if (
        err instanceof Error &&
        (err as { rateLimited?: boolean }).rateLimited === true
      ) {
        consecutiveRateLimited += 1;
        if (consecutiveRateLimited >= 3) {
          throw new Error(
            "3 rejets 429 consecutifs : arret pour respecter la limite de debit (relancez plus tard, l'import est idempotent).",
            { cause: err },
          );
        }
      }
    }
    if (i < urls.length - 1) {
      // Jitter anti-pattern robotique.
      await new Promise((r) =>
        setTimeout(r, delayMs + Math.floor(Math.random() * 1000)),
      );
    }
  }

  if (!dryRun) {
    const out = (await search?.({ query: "xiaomi", limit: 100 })) as
      | { count: number }
      | undefined;
    console.log(
      `TERMINE : crees=${created} doublons=${skipped} echecs=${failed.length} fiches-xiaomi=${out?.count ?? "?"}`,
    );
    for (const u of failed) console.log(`  ECHEC: ${u}`);
  }
}

// Script CLI : sorties console voulues (stdout = rapport d'import).
main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);
