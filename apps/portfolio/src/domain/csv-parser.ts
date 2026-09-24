/**
 * @apps/portfolio/domain — RFC4180 CSV Record Parser and Input Sanitizer
 */

/**
 * Minimal RFC4180 record parser: handles quoted fields, embedded commas
 * and doubled quotes. Returns raw (still unquoted) field values.
 */
export function parseCsvRecord(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

export function isSafeAttributeKey(key: string): boolean {
  return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}
