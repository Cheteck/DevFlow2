/**
 * @mosaix/migrations — Source checksum (Phase 07, Lot moteur).
 *
 * Les migrations TypeScript natives ne portent pas de SQL enchané : leur
 * contenu utile est le *code source* du module (`up()` / `downMigration()`).
 * Or `Function.toString()` n'est pas une empreinte stable (minification,
 * transpilation, formatage), et le checksum doit couvrir ce qui est
 * réellement exécuté — y compris les dépendances locales importées.
 *
 * Ce module fournit :
 *
 * 1. `computeSourceChecksum(sources)` — SHA-256 (implémentation pure TS,
 *    synchrone, sans dépendance) sur des sources normalisées. Le digest est
 *    hexadécimal (64 caractères) : format accepté par le MigrationValidator
 *    comme « checksum de build ».
 * 2. `normalizeSource(source)` — normalisation déterministe (CRLF → LF,
 *    espaces de fin de ligne supprimés, bloc de checksum retiré) pour que
 *    deux fichiers au contenu sémantiquement identique donnent le même
 *    digest.
 * 3. `readSourceChecksum` / `withSourceChecksum` — lecture et réécriture du
 *    bloc de checksum déclaré dans un fichier de migration.
 *
 * Le bloc de checksum canonique est :
 *
 * ```ts
 * /* checksum:begin *\/
 * export const MIGRATION_CHECKSUM = "…64 hex…";
 * /* checksum:end *\/
 * ```
 *
 * Il est retiré de la source avant calcul (sinon le checksum se calculerait
 * lui-même), et il est réécrit par l'outillage (`scripts/migration-checksums.ts`).
 */

export const CHECKSUM_BLOCK_BEGIN = "/* checksum:begin */";
export const CHECKSUM_BLOCK_END = "/* checksum:end */";

/** SHA-256 round constants (FIPS 180-4). */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_HASH = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
  0x1f83d9ab, 0x5be0cd19,
]);

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** SHA-256 over bytes — pure TypeScript, synchrone, runtime-agnostic. */
export function sha256Hex(message: Uint8Array): string {
  const byteLength = message.length;
  const paddedLength = (((byteLength + 8) >> 6) + 1) << 6;
  const data = new Uint8Array(paddedLength);
  data.set(message);
  data[byteLength] = 0x80;

  // Longueur en bits, big-endian 64 bits.
  const bitLength = BigInt(byteLength) * 8n;
  for (let i = 0; i < 8; i++) {
    data[paddedLength - 1 - i] = Number((bitLength >> BigInt(8 * i)) & 0xffn);
  }

  const hash = INITIAL_HASH.slice();
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i++) {
      const base = offset + i * 4;
      w[i] =
        ((data[base]! << 24) |
          (data[base + 1]! << 16) |
          (data[base + 2]! << 8) |
          data[base + 3]!) >>>
        0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 =
        rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = hash[0]!;
    let b = hash[1]!;
    let c = hash[2]!;
    let d = hash[3]!;
    let e = hash[4]!;
    let f = hash[5]!;
    let g = hash[6]!;
    let h = hash[7]!;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    hash[0] = (hash[0]! + a) >>> 0;
    hash[1] = (hash[1]! + b) >>> 0;
    hash[2] = (hash[2]! + c) >>> 0;
    hash[3] = (hash[3]! + d) >>> 0;
    hash[4] = (hash[4]! + e) >>> 0;
    hash[5] = (hash[5]! + f) >>> 0;
    hash[6] = (hash[6]! + g) >>> 0;
    hash[7] = (hash[7]! + h) >>> 0;
  }

  let hex = "";
  for (const word of hash) {
    hex += word.toString(16).padStart(8, "0");
  }
  return hex;
}

/**
 * Retire le bloc de checksum déclaré d'une source.
 * Sans cela, le checksum se couvrirait lui-même.
 */
export function stripChecksumBlock(source: string): string {
  const begin = source.indexOf(CHECKSUM_BLOCK_BEGIN);
  const end = source.indexOf(CHECKSUM_BLOCK_END);
  if (begin < 0 || end < 0 || end < begin) {
    return source;
  }
  return source.slice(0, begin) + source.slice(end + CHECKSUM_BLOCK_END.length);
}

/**
 * Normalise une source pour un checksum déterministe :
 * - CRLF → LF,
 * - espaces de fin de ligne supprimés,
 * - bloc de checksum retiré,
 * - dernière ligne vide supprimée.
 */
export function normalizeSource(source: string): string {
  return stripChecksumBlock(source)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "\n");
}

/**
 * Calcule le checksum de build d'une migration TypeScript.
 *
 * @param sources sources à(hasher, dans l'ordre : dépendances d'abord,
 *   puis le module de migration). Chaque source est normalisée avant calcul.
 * @returns digest SHA-256 hexadécimal (64 caractères).
 */
export function computeSourceChecksum(sources: readonly string[]): string {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const source of sources) {
    parts.push(encoder.encode(normalizeSource(source)));
  }

  let total = 0;
  for (const part of parts) {
    total += part.length;
  }
  const merged = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    merged.set(part, cursor);
    cursor += part.length;
  }
  return sha256Hex(merged);
}

/**
 * Lit le checksum de build déclaré dans un fichier de migration.
 *
 * @returns le checksum hexadécimal déclaré, ou `undefined` si le fichier
 *   ne contient pas de bloc de checksum.
 */
export function readSourceChecksum(source: string): string | undefined {
  const begin = source.indexOf(CHECKSUM_BLOCK_BEGIN);
  const end = source.indexOf(CHECKSUM_BLOCK_END);
  if (begin < 0 || end < 0 || end < begin) {
    return undefined;
  }
  const block = source.slice(begin + CHECKSUM_BLOCK_BEGIN.length, end);
  const match = /["'`]([0-9a-fA-F]{16,})["'`]/.exec(block);
  return match?.[1];
}

/**
 * Réécrit le checksum de build déclaré dans un fichier de migration.
 *
 * Si le fichier ne contient pas de bloc de checksum, il est ajouté à la fin
 * de la source (avec le séparateur attendu par les linters).
 *
 * Tous les blocs présents sont réécrits : un module ne déclare qu'une
 * migration, donc un seul checksum effectif.
 */
export function withSourceChecksum(source: string, checksum: string): string {
  const begin = source.indexOf(CHECKSUM_BLOCK_BEGIN);
  const end = source.indexOf(CHECKSUM_BLOCK_END);

  if (begin < 0 || end < 0 || end < begin) {
    const separator = source.endsWith("\n") ? "" : "\n";
    return (
      `${source}${separator}\n${CHECKSUM_BLOCK_BEGIN}\n` +
      `export const MIGRATION_CHECKSUM = "${checksum}";\n` +
      `${CHECKSUM_BLOCK_END}\n`
    );
  }

  let result = "";
  let cursor = 0;
  while (cursor < source.length) {
    const blockBegin = source.indexOf(CHECKSUM_BLOCK_BEGIN, cursor);
    if (blockBegin < 0) {
      result += source.slice(cursor);
      break;
    }
    const blockEnd = source.indexOf(CHECKSUM_BLOCK_END, blockBegin);
    if (blockEnd < 0) {
      result += source.slice(cursor);
      break;
    }
    result += source.slice(cursor, blockBegin + CHECKSUM_BLOCK_BEGIN.length);
    result += `\nexport const MIGRATION_CHECKSUM = "${checksum}";\n`;
    cursor = blockEnd;
  }
  return result;
}
