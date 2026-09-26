/**
 * @scripts/generate-themes — deterministic theme library generator.
 *
 * Source table: curated light palettes (primary/secondary/accent/background/
 * surface/text/muted/border + success/warning/danger). Everything else is
 * DERIVED with documented rules so the 17 themes stay interchangeable:
 *
 * - light overlay: background/surface/text/textMuted/border verbatim.
 * - dark overlay: background/surface pushed toward black, text toward white,
 *   primary/accent/status lightened for vibrancy on dark.
 * - high-contrast overlay: pure black/white + lightened primary.
 * - tailwind ramps: surface container steps mixed between surface and text;
 *   primary-container tinted toward background; on-primary picked by WCAG
 *   contrast (white vs ink, best ratio wins).
 * - typography/spacing/radius/shadows/motion: copied from
 *   themes/mosaix-default/theme.json (structural consistency).
 *
 * themes/*.json remain the single source of truth — this script is only the
 * (re-)generator. Usage: `pnpm exec tsx scripts/generate-themes.ts`.
 * Fails on contrast regressions (light or dark text/bg < 4.5).
 */
import * as fs from "node:fs";
import * as path from "node:path";

interface Palette {
  id: string;
  name: string;
  generate: boolean;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

const PALETTES: Palette[] = [
  {
    id: "mosaix-default",
    name: "MosaiX Default Theme",
    generate: false,
    primary: "#4f46e5",
    secondary: "#06b6d4",
    accent: "#8b5cf6",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
  {
    id: "luxury",
    name: "Luxury",
    generate: true,
    primary: "#18181b",
    secondary: "#c9a227",
    accent: "#e5c76b",
    background: "#f5f3ee",
    surface: "#ffffff",
    text: "#18181b",
    muted: "#71717a",
    border: "#d6d3d1",
    success: "#3f8f68",
    warning: "#c99a32",
    danger: "#b94a48",
  },
  {
    id: "ocean",
    name: "Ocean",
    generate: true,
    primary: "#075985",
    secondary: "#06b6d4",
    accent: "#0284c7",
    background: "#f0f9ff",
    surface: "#ffffff",
    text: "#102a43",
    muted: "#627d98",
    border: "#cbdde8",
    success: "#0f9f83",
    warning: "#d18a25",
    danger: "#d65b5b",
  },
  {
    id: "forest",
    name: "Forest",
    generate: true,
    primary: "#166534",
    secondary: "#65a30d",
    accent: "#84cc16",
    background: "#f3f7f0",
    surface: "#ffffff",
    text: "#17251c",
    muted: "#657568",
    border: "#d5dfd2",
    success: "#4d8a5a",
    warning: "#b7791f",
    danger: "#c2413b",
  },
  {
    id: "midnight",
    name: "Midnight",
    generate: true,
    primary: "#6366f1",
    secondary: "#22d3ee",
    accent: "#a855f7",
    background: "#080d1a",
    surface: "#111827",
    text: "#f1f5f9",
    muted: "#94a3b8",
    border: "#293548",
    success: "#34d399",
    warning: "#fbbf24",
    danger: "#f87171",
  },
  {
    id: "nordic",
    name: "Nordic",
    generate: true,
    primary: "#334e68",
    secondary: "#829ab1",
    accent: "#486581",
    background: "#f5f7f8",
    surface: "#ffffff",
    text: "#243b53",
    muted: "#627d98",
    border: "#d9e2ec",
    success: "#4f8a72",
    warning: "#c28b3c",
    danger: "#c45b58",
  },
  {
    id: "sunset",
    name: "Sunset",
    generate: true,
    primary: "#c2410c",
    secondary: "#f97316",
    accent: "#db2777",
    background: "#fff7ed",
    surface: "#ffffff",
    text: "#292524",
    muted: "#78716c",
    border: "#fed7aa",
    success: "#16a34a",
    warning: "#ea580c",
    danger: "#dc2626",
  },
  {
    id: "terracotta",
    name: "Terracotta",
    generate: true,
    primary: "#9a3412",
    secondary: "#c2410c",
    accent: "#b45309",
    background: "#f8f1e8",
    surface: "#fffcf7",
    text: "#29231f",
    muted: "#78716c",
    border: "#ded3c6",
    success: "#4d7c5a",
    warning: "#b7791f",
    danger: "#b4534b",
  },
  {
    id: "sage",
    name: "Sage",
    generate: true,
    primary: "#3f5f50",
    secondary: "#7c9479",
    accent: "#a3b18a",
    background: "#f4f5ef",
    surface: "#fefefa",
    text: "#29332d",
    muted: "#718078",
    border: "#d9ded6",
    success: "#527a5e",
    warning: "#b58a3a",
    danger: "#b85c55",
  },
  {
    id: "aurora",
    name: "Aurora",
    generate: true,
    primary: "#4f46e5",
    secondary: "#06b6d4",
    accent: "#d946ef",
    background: "#f5f3ff",
    surface: "#ffffff",
    text: "#18152e",
    muted: "#6b6685",
    border: "#ddd6fe",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
  },
  {
    id: "monochrome",
    name: "Monochrome",
    generate: true,
    primary: "#171717",
    secondary: "#525252",
    accent: "#737373",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#171717",
    muted: "#737373",
    border: "#d4d4d4",
    success: "#404040",
    warning: "#737373",
    danger: "#171717",
  },
  {
    id: "arctic",
    name: "Arctic",
    generate: true,
    primary: "#0369a1",
    secondary: "#0891b2",
    accent: "#38bdf8",
    background: "#f7fbfd",
    surface: "#ffffff",
    text: "#172b3a",
    muted: "#64808f",
    border: "#d5e5ec",
    success: "#0f8a72",
    warning: "#c58a32",
    danger: "#c75454",
  },
  {
    id: "desert",
    name: "Desert",
    generate: true,
    primary: "#9a3412",
    secondary: "#c2410c",
    accent: "#b7791f",
    background: "#faf5eb",
    surface: "#fffdf8",
    text: "#30251f",
    muted: "#806f63",
    border: "#e4d8ca",
    success: "#65805b",
    warning: "#b7791f",
    danger: "#b94c3f",
  },
  {
    id: "plum",
    name: "Plum",
    generate: true,
    primary: "#6b21a8",
    secondary: "#a855f7",
    accent: "#db2777",
    background: "#faf5ff",
    surface: "#ffffff",
    text: "#27152f",
    muted: "#76617c",
    border: "#e9d5f5",
    success: "#15803d",
    warning: "#ca8a04",
    danger: "#be123c",
  },
  {
    id: "cobalt",
    name: "Cobalt",
    generate: true,
    primary: "#1d4ed8",
    secondary: "#0ea5e9",
    accent: "#06b6d4",
    background: "#eff6ff",
    surface: "#ffffff",
    text: "#172554",
    muted: "#64748b",
    border: "#bfdbfe",
    success: "#059669",
    warning: "#d97706",
    danger: "#dc2626",
  },
  {
    id: "copper",
    name: "Copper",
    generate: true,
    primary: "#7c2d12",
    secondary: "#b45309",
    accent: "#c2410c",
    background: "#f7f1ea",
    surface: "#fffcf8",
    text: "#29201c",
    muted: "#786d67",
    border: "#ded2c9",
    success: "#4f7d59",
    warning: "#b7791f",
    danger: "#b94b42",
  },
  {
    id: "lime",
    name: "Lime",
    generate: true,
    primary: "#365314",
    secondary: "#65a30d",
    accent: "#a3e635",
    background: "#f7fceb",
    surface: "#ffffff",
    text: "#1a2410",
    muted: "#68745c",
    border: "#d9e4c5",
    success: "#4d7c0f",
    warning: "#ca8a04",
    danger: "#b91c1c",
  },
  {
    id: "paper",
    name: "Paper",
    generate: true,
    primary: "#292524",
    secondary: "#b91c1c",
    accent: "#9f1239",
    background: "#f7f3ea",
    surface: "#fffcf5",
    text: "#292524",
    muted: "#78716c",
    border: "#ddd6c8",
    success: "#3f7d4f",
    warning: "#b7791f",
    danger: "#b91c1c",
  },
];

// ── Color math ────────────────────────────────────────────────
type RGB = [number, number, number];

function toRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return [
    Number.parseInt(v.slice(0, 2), 16),
    Number.parseInt(v.slice(2, 4), 16),
    Number.parseInt(v.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]: RGB): string {
  const c = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toLowerCase();
}

/** mix(a, b, t): t=0 → a, t=1 → b. */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((l1 ?? 0) + 0.05) / ((l2 ?? 0) + 0.05);
}

/** Best readable text on bg: white vs ink. */
function onColor(bg: string): string {
  return contrast(bg, "#ffffff") >= contrast(bg, "#171614")
    ? "#ffffff"
    : "#171614";
}

// ── Manifest builder ─────────────────────────────────────────
interface SharedGroups {
  typography: unknown;
  spacing: unknown;
  radius: unknown;
  shadows: unknown;
  motion: unknown;
}

function buildManifest(
  p: Palette,
  shared: SharedGroups,
): Record<string, unknown> {
  const dark = {
    primary: mix(p.primary, "#ffffff", 0.15),
    primaryHover: mix(p.primary, "#ffffff", 0.3),
    background: mix(p.background, "#000000", 0.87),
    surface: mix(p.background, "#000000", 0.78),
    text: mix(p.text, "#ffffff", 0.9),
    textMuted: mix(p.muted, "#ffffff", 0.35),
    border: mix(p.border, "#000000", 0.55),
  };
  const hcPrimary = mix(p.primary, "#ffffff", 0.35);
  const colors = {
    primary: p.primary,
    primaryHover: mix(p.primary, "#000000", 0.15),
    secondary: p.secondary,
    background: p.background,
    surface: p.surface,
    text: p.text,
    textMuted: p.muted,
    border: p.border,
    accent: p.accent,
    danger: p.danger,
    success: p.success,
    warning: p.warning,
  };
  const tailwindLight = {
    surface: p.surface,
    "surface-container-lowest": p.surface,
    "surface-container-low": p.background,
    "surface-container": mix(p.background, p.text, 0.06),
    "surface-container-high": p.border,
    "surface-container-highest": mix(p.border, p.text, 0.15),
    "surface-variant": mix(p.background, p.text, 0.06),
    "on-surface": p.text,
    "on-surface-variant": p.muted,
    primary: p.primary,
    "on-primary": onColor(p.primary),
    "primary-container": mix(p.primary, p.background, 0.8),
    secondary: p.secondary,
    tertiary: p.accent,
    outline: mix(p.border, p.text, 0.25),
    "outline-variant": p.border,
    background: p.background,
  };
  const tailwindDark = {
    surface: dark.surface,
    "surface-container-lowest": mix(dark.surface, "#000000", 0.45),
    "surface-container-low": mix(dark.surface, "#000000", 0.2),
    "surface-container": mix(dark.surface, dark.text, 0.07),
    "surface-container-high": mix(dark.surface, dark.text, 0.16),
    "surface-container-highest": mix(dark.surface, dark.text, 0.28),
    "surface-variant": mix(dark.surface, dark.text, 0.07),
    "on-surface": dark.text,
    "on-surface-variant": dark.textMuted,
    primary: dark.primary,
    "on-primary": onColor(dark.primary),
    "primary-container": mix(dark.primary, dark.background, 0.55),
    secondary: mix(p.secondary, "#ffffff", 0.1),
    tertiary: mix(p.accent, "#ffffff", 0.15),
    outline: mix(dark.border, dark.text, 0.3),
    "outline-variant": dark.border,
    background: dark.background,
  };
  const tailwindHc = {
    surface: "#000000",
    "surface-container-lowest": "#000000",
    "surface-container-low": "#000000",
    "surface-container": "#000000",
    "surface-container-high": "#1a1a1a",
    "surface-container-highest": "#2a2a2a",
    "surface-variant": "#1a1a1a",
    "on-surface": "#ffffff",
    "on-surface-variant": "#ffffff",
    primary: hcPrimary,
    "on-primary": "#000000",
    "primary-container": hcPrimary,
    secondary: "#ffffff",
    tertiary: "#ffffff",
    outline: "#ffffff",
    "outline-variant": "#ffffff",
    background: "#000000",
  };
  return {
    type: "theme",
    id: p.id,
    name: p.name,
    version: "1.0.0",
    contractVersion: "1.0.0",
    tokens: {
      colors,
      ...shared,
      tailwind: tailwindLight,
    },
    modes: {
      light: {
        colors: {
          background: p.background,
          surface: p.surface,
          text: p.text,
          textMuted: p.muted,
          border: p.border,
        },
      },
      dark: {
        colors: {
          primary: dark.primary,
          primaryHover: dark.primaryHover,
          background: dark.background,
          surface: dark.surface,
          text: dark.text,
          textMuted: dark.textMuted,
          border: dark.border,
        },
        tailwind: tailwindDark,
      },
      "high-contrast": {
        colors: {
          primary: hcPrimary,
          primaryHover: mix(p.primary, "#ffffff", 0.5),
          background: "#000000",
          surface: "#000000",
          text: "#ffffff",
          textMuted: "#ffffff",
          border: "#ffffff",
        },
        tailwind: tailwindHc,
      },
    },
  };
}

// ── Main ─────────────────────────────────────────────────────
function main(): void {
  const root = process.cwd();
  const reference = JSON.parse(
    fs.readFileSync(
      path.join(root, "themes", "mosaix-default", "theme.json"),
      "utf-8",
    ),
  ) as { tokens: Record<string, unknown> };
  const shared: SharedGroups = {
    typography: reference.tokens.typography,
    spacing: reference.tokens.spacing,
    radius: reference.tokens.radius,
    shadows: reference.tokens.shadows,
    motion: reference.tokens.motion,
  };

  const failures: string[] = [];
  for (const p of PALETTES) {
    if (!p.generate) continue;
    const manifest = buildManifest(p, shared);
    const dir = path.join(root, "themes", p.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, "theme.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf-8",
    );
    fs.writeFileSync(
      path.join(dir, "preview.png"),
      "PNG_DUMMY_PREVIEW\n",
      "utf-8",
    );

    const lightRatio = contrast(p.text, p.background);
    const darkBg = mix(p.background, "#000000", 0.87);
    const darkText = mix(p.text, "#ffffff", 0.9);
    const darkRatio = contrast(darkText, darkBg);
    const status =
      lightRatio >= 4.5 && darkRatio >= 4.5 ? "ok" : "LOW-CONTRAST";
    if (status !== "ok") failures.push(p.id);
    console.log(
      `[generate-themes] ${p.id}: light ${lightRatio.toFixed(2)} / dark ${darkRatio.toFixed(2)} — ${status}`,
    );
  }
  if (failures.length > 0) {
    console.error(
      `[generate-themes] FAIL — contrast < 4.5: ${failures.join(", ")}`,
    );
    process.exit(1);
  }
  console.log("[generate-themes] done.");
}

main();
