/**
 * @apps/portfolio/domain — Gestion des options produit (couleurs, etc.).
 *
 * Une option est un axe de choix non tarifaire : groupe nomme (code stable)
 * + valeurs possibles + contraintes de compatibilite. Le PIM decrit ce qui
 * existe ; le prix, le stock et la disponibilite restent du ressort de
 * Commerce (jamais ici).
 *
 * Forme de stockage (stable, compatible avec l'existant) : bloc `options`
 * sous `characteristics.attributes`, e.g.
 * `{ color: { label, values: [...], source?, modeling?, note? } }`.
 */

export interface ProductOptionValueInput {
  value: string;
  label?: string | undefined;
  /** Valeurs incompatibles, referencees par valeur brute (meme groupe ou autre). */
  incompatibleWith?: string[] | undefined;
}

export interface ProductOptionGroupInput {
  code: string;
  label?: string | undefined;
  required?: boolean | undefined;
  values: ProductOptionValueInput[];
  source?: string | undefined;
  modeling?: string | undefined;
  note?: string | undefined;
}

export interface ProductOptionGroup extends ProductOptionGroupInput {
  values: Required<ProductOptionValueInput>[];
}

const FORBIDDEN_OPTION_TOKENS = [
  "price",
  "pricing",
  "stock",
  "inventory",
  "seller",
  "availability",
  "booking",
  "order",
];

function tokenizeKey(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);
}

/**
 * Canonicalisation des codes (features, groupes, slugs logiques) : casse,
 * accents, espaces et separateurs unifies ; les points structurants des
 * chemins pointes sont preserves. Idempotent. Source unique utilisee par
 * le domaine et la persistance (anti-doublons ADR-0018).
 */
export function normalizeFeatureCode(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_.]+|[_.]+$/g, "");
}

/**
 * Canonicalisation des codes d'options (meme regle que les features).
 */
export function normalizeOptionCode(raw: string): string {
  return normalizeFeatureCode(raw);
}

/** Normalise un bloc d'options (premier ecrit gagne en cas de doublon). */
export function normalizeProductOptions(
  groups: ProductOptionGroupInput[],
): ProductOptionGroup[] {
  const seen = new Set<string>();
  const out: ProductOptionGroup[] = [];
  for (const group of groups) {
    const code = normalizeOptionCode(group.code);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const seenValues = new Set<string>();
    const values: Required<ProductOptionValueInput>[] = [];
    for (const v of group.values ?? []) {
      const value = v.value.trim();
      if (!value || seenValues.has(value.toLowerCase())) continue;
      seenValues.add(value.toLowerCase());
      values.push({
        value,
        label: v.label?.trim() || value,
        incompatibleWith: [...(v.incompatibleWith ?? [])].map((s) =>
          s.trim(),
        ).filter((s) => s.length > 0),
      });
    }
    out.push({
      code,
      label: group.label?.trim() || code,
      required: group.required ?? false,
      values,
      source: group.source?.trim() || undefined,
      modeling: group.modeling?.trim() || undefined,
      note: group.note?.trim() || undefined,
    });
  }
  return out;
}

/** Valide des groupes d'options ; retourne la liste d'erreurs (vide = OK). */
export function validateProductOptions(
  groups: ProductOptionGroupInput[],
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(groups)) return ["options : liste de groupes attendue"];
  const seen = new Set<string>();
  groups.forEach((group, index) => {
    const where = `options[${index}]`;
    const code = normalizeOptionCode(group.code ?? "");
    if (!code) {
      errors.push(`${where} : code manquant`);
      return;
    }
    if (seen.has(code)) {
      errors.push(`${where} : code duplique '${code}'`);
      return;
    }
    seen.add(code);
    for (const token of tokenizeKey(code)) {
      if (FORBIDDEN_OPTION_TOKENS.includes(token)) {
        errors.push(
          `${where} : code '${code}' a portee commerciale (donnee Commerce, pas PIM)`,
        );
        break;
      }
    }
    if (!Array.isArray(group.values) || group.values.length === 0) {
      errors.push(`${where} ('${code}') : au moins une valeur requise`);
    } else {
      const seenValues = new Set<string>();
      group.values.forEach((v, vi) => {
        const value = v.value?.trim() ?? "";
        if (!value) {
          errors.push(`${where}.values[${vi}] : valeur vide`);
          return;
        }
        const folded = value.toLowerCase();
        if (seenValues.has(folded)) {
          errors.push(`${where} : valeur dupliquee '${value}'`);
          return;
        }
        seenValues.add(folded);
      });
    }
  });
  // References d'incompatibilite : doivent designer des valeurs existantes.
  const known = new Set<string>();
  for (const group of groups) {
    const code = normalizeOptionCode(group.code ?? "");
    for (const v of group.values ?? []) {
      const value = v.value?.trim() ?? "";
      if (value) known.add(`${code}:${value.toLowerCase()}`);
    }
  }
  groups.forEach((group, index) => {
    const code = normalizeOptionCode(group.code ?? "");
    for (const v of group.values ?? []) {
      for (const ref of v.incompatibleWith ?? []) {
        const target = ref.includes(":")
          ? `${normalizeOptionCode(ref.split(":")[0] as string)}:${(ref.split(":").slice(1).join(":")).trim().toLowerCase()}`
          : `${code}:${ref.trim().toLowerCase()}`;
        if (!known.has(target)) {
          errors.push(
            `options[${index}] ('${v.value}') : incompatibilite vers une valeur inconnue '${ref}'`,
          );
        }
      }
    }
  });
  return errors;
}

/**
 * Valide une configuration { codeGroupe: valeur } contre les groupes :
 * groupes inconnus, valeurs inconnues, groupes requis manquants et paires
 * incompatibles. Retourne la liste d'erreurs (vide = configuration valide).
 */
export function validateConfiguration(
  groups: ProductOptionGroupInput[],
  config: Record<string, string>,
): string[] {
  const errors: string[] = [];
  const normalized = normalizeProductOptions(groups);
  const byCode = new Map(normalized.map((g) => [g.code, g]));
  for (const [rawCode, rawValue] of Object.entries(config)) {
    const code = normalizeOptionCode(rawCode);
    const group = byCode.get(code);
    if (!group) {
      errors.push(`configuration : groupe inconnu '${rawCode}'`);
      continue;
    }
    const value = rawValue.trim();
    if (!group.values.some((v) => v.value.toLowerCase() === value.toLowerCase())) {
      errors.push(`configuration : valeur inconnue '${rawValue}' pour '${code}'`);
    }
  }
  for (const group of normalized) {
    if (!group.required) continue;
    const present = Object.keys(config).some(
      (k) => normalizeOptionCode(k) === group.code,
    );
    if (!present) {
      errors.push(`configuration : option requise manquante '${group.code}'`);
    }
  }
  const selected = new Map<string, string>();
  for (const [rawCode, rawValue] of Object.entries(config)) {
    const code = normalizeOptionCode(rawCode);
    if (byCode.has(code)) selected.set(code, rawValue.trim().toLowerCase());
  }
  for (const [code, value] of selected) {
    const group = byCode.get(code);
    const option = group?.values.find((v) => v.value.toLowerCase() === value);
    for (const ref of option?.incompatibleWith ?? []) {
      const [refCodeRaw, ...rest] = ref.split(":");
      const refCode = rest.length > 0 ? normalizeOptionCode(refCodeRaw ?? "") : code;
      const refValue = (rest.length > 0 ? rest.join(":") : ref).trim().toLowerCase();
      if (selected.get(refCode) === refValue) {
        errors.push(
          `configuration : '${code}=${value}' incompatible avec '${refCode}=${refValue}'`,
        );
      }
    }
  }
  return errors;
}

/** Forme de stockage (bloc `options` des attributs). */
export function groupsToOptionsBlock(
  groups: ProductOptionGroup[],
): Record<string, unknown> {
  const block: Record<string, unknown> = {};
  for (const group of groups) {
    const entry: Record<string, unknown> = {
      label: group.label,
      values: group.values.map((v) => v.value),
    };
    if (group.source) entry["source"] = group.source;
    if (group.modeling) entry["modeling"] = group.modeling;
    if (group.note) entry["note"] = group.note;
    const withCompat = group.values.filter(
      (v) => v.incompatibleWith.length > 0,
    );
    if (withCompat.length > 0) {
      entry["incompatible"] = Object.fromEntries(
        withCompat.map((v) => [v.value, v.incompatibleWith]),
      );
    }
    block[group.code] = entry;
  }
  return block;
}

/** Lecture : reconstitue des groupes types depuis un bloc de stockage. */
export function optionsBlockToGroups(
  block: unknown,
): ProductOptionGroup[] {
  if (block === null || typeof block !== "object" || Array.isArray(block)) {
    return [];
  }
  const groups: ProductOptionGroupInput[] = [];
  for (const [code, entry] of Object.entries(
    block as Record<string, unknown>,
  )) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const values = Array.isArray(record["values"])
      ? (record["values"] as unknown[])
      : [];
    const incompatible = (
      record["incompatible"] !== null &&
      typeof record["incompatible"] === "object" &&
      !Array.isArray(record["incompatible"])
        ? record["incompatible"]
        : {}
    ) as Record<string, unknown>;
    groups.push({
      code,
      label: typeof record["label"] === "string" ? record["label"] : undefined,
      values: values
        .filter((v): v is string => typeof v === "string")
        .map((value) => ({
          value,
          incompatibleWith: Array.isArray(incompatible[value])
            ? ((incompatible[value] as unknown[]).filter((s): s is string => typeof s === "string"))
            : [],
        })),
      source: typeof record["source"] === "string" ? record["source"] : undefined,
      modeling: typeof record["modeling"] === "string" ? record["modeling"] : undefined,
      note: typeof record["note"] === "string" ? record["note"] : undefined,
    });
  }
  return normalizeProductOptions(groups);
}
