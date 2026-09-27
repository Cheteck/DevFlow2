import type * as http from "node:http";
import type { URL } from "node:url";
import type { DatabasePort } from "@mosaix/ports-database";

export interface UserProfile {
  id: string;
  name: string;
  handle: string;
  role: "member" | "moderator" | "admin";
  roleLabel: string;
  badgeClass: string;
  avatar: string;
  allowedBacs: string[]; // BAC IDs visible in Primary Sidebar
  permissions: string[]; // Specific permission strings
}

export const USER_PROFILES: Record<string, UserProfile> = {
  member: {
    id: "user-1",
    name: "Alex M.",
    handle: "@alex_member",
    role: "member",
    roleLabel: "Membre Standard",
    badgeClass: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    avatar: "👤",
    allowedBacs: [
      "identity",
      "solara",
      "spaces",
      "portfolio",
      "booking",
      "beam",
      "subscription",
    ],
    permissions: [
      "identity:view:profile",
      "solara:read:feed",
      "solara:create:post",
      "spaces:view:dashboard",
      "portfolio:view:catalog",
      "booking:reservation:create:tenant",
      "booking:slot:read:tenant",
      "beam:send:message",
    ],
  },
  moderator: {
    id: "user-2",
    name: "Sarah K.",
    handle: "@sarah_mod",
    role: "moderator",
    roleLabel: "Modérateur",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    avatar: "🛡️",
    allowedBacs: [
      "identity",
      "solara",
      "solidarity",
      "commerce",
      "spaces",
      "portfolio",
      "booking",
      "beam",
      "subscription",
    ],
    permissions: [
      "identity:view:profile",
      "solara:read:feed",
      "solara:create:post",
      "solara:moderate:content",
      "solidarity:view:campaigns",
      "solidarity:contribute",
      "commerce:checkout",
      "spaces:view:dashboard",
      "portfolio:view:catalog",
      "booking:reservation:create:tenant",
      "booking:slot:read:tenant",
      "beam:send:message",
    ],
  },
  admin: {
    id: "user-3",
    name: "Admin Imperia",
    handle: "@admin_imperia",
    role: "admin",
    roleLabel: "Administrateur",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    avatar: "👑",
    allowedBacs: [
      "identity",
      "solara",
      "solidarity",
      "imperia",
      "spaces",
      "commerce",
      "beam",
      "portfolio",
      "booking",
      "subscription",
    ],
    permissions: [
      "identity:view:profile",
      "identity:admin:users",
      "solara:read:feed",
      "solara:create:post",
      "solara:moderate:content",
      "solara:admin:settings",
      "solidarity:view:campaigns",
      "solidarity:contribute",
      "solidarity:admin:manage",
      "imperia:governance:vote",
      "imperia:governance:propose",
      "imperia:admin:manage",
      "spaces:view:dashboard",
      "spaces:admin:manage",
      "commerce:checkout",
      "commerce:admin:inventory",
      "portfolio:view:catalog",
      "portfolio:admin:manage",
      "booking:slot:create:tenant",
      "booking:slot:read:tenant",
      "booking:reservation:create:tenant",
      "booking:slot:admin:tenant",
      "beam:send:message",
    ],
  },
};

export interface SpaceProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  ownerUserRole: "member" | "moderator" | "admin";
  badge: string;
}

let spacesCache: SpaceProfile[] | null = null;
let spacesCacheTime = 0;
const SPACES_CACHE_TTL = 60000; // 1 minute

/**
 * Sync compatibility view over the DB-backed spaces cache.
 *
 * The SSR renderers (`renderer.ts`) resolve a space id synchronously, so
 * they cannot await `getAvailableSpaces()`. This array is kept in sync on
 * every cache fill; `getActiveSpaceProfile()` (called before rendering in
 * `src/start.ts`) populates it, so id lookups keep working without a
 * second query. Treat as read-only outside this module.
 */
export const SPACES_LIST: SpaceProfile[] = [];

function syncSpacesList(spaces: SpaceProfile[]): void {
  SPACES_LIST.length = 0;
  SPACES_LIST.push(...spaces);
}

async function loadSpacesFromDatabase(db: DatabasePort): Promise<SpaceProfile[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT id, name, description, owner_role, badge, avatar, members_count, is_private, created_at FROM spaces`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    handle: `@${String(row.name).toLowerCase().replace(/\s+/g, "-")}`,
    avatar: row.avatar ? String(row.avatar) : "📁",
    ownerUserRole: (row.owner_role as "member" | "moderator" | "admin") || "member",
    badge: row.badge ? String(row.badge) : "Space",
  }));
}

export async function getAvailableSpaces(
  db: DatabasePort,
): Promise<SpaceProfile[]> {
  const now = Date.now();
  if (spacesCache && now - spacesCacheTime < SPACES_CACHE_TTL) {
    return spacesCache;
  }

  try {
    spacesCache = await loadSpacesFromDatabase(db);
    spacesCacheTime = now;
    syncSpacesList(spacesCache);
  } catch {
    spacesCache = [];
    syncSpacesList(spacesCache);
  }

  return spacesCache;
}

export async function getActiveSpaceProfile(
  req: http.IncomingMessage,
  parsedUrl: URL,
  db: DatabasePort,
): Promise<SpaceProfile | null> {
  const spaceQuery = parsedUrl.searchParams.get("spaceId");
  const spaces = await getAvailableSpaces(db);

  if (spaceQuery) {
    const space = spaces.find((s) => s.id === spaceQuery);
    if (space) return space;
  }

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/mosaix_active_space=([a-zA-Z0-9_-]+)/);
  if (match) {
    const space = spaces.find((s) => s.id === match[1]);
    if (space) return space;
  }

  return null;
}

export function getActiveUserProfile(
  req: http.IncomingMessage,
  parsedUrl: URL,
): UserProfile {
  // Query-param override is a demo convenience — never in production.
  if (isDemoMode()) {
    const roleQuery =
      parsedUrl.searchParams.get("role") || parsedUrl.searchParams.get("user");
    if (roleQuery && USER_PROFILES[roleQuery]) {
      return USER_PROFILES[roleQuery];
    }
  }

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/mosaix_role=([a-z_]+)/);
  if (match && USER_PROFILES[match[1]]) {
    return USER_PROFILES[match[1]];
  }

  return USER_PROFILES.member;
}

/**
 * Demo session switcher flag (usermenu "Aperçu Démo", `?role=`,
 * `/api/user/switch`). Explicit `MOSAIX_DEMO_USERS` wins; otherwise the
 * switcher is enabled everywhere except production.
 */
export function isDemoMode(
  source: Record<string, string | undefined> = typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {},
): boolean {
  const raw = source.MOSAIX_DEMO_USERS;
  if (raw !== undefined && raw !== "") {
    const v = raw.toLowerCase().trim();
    return v === "true" || v === "1" || v === "yes" || v === "on";
  }
  const env = source.MOSAIX_ENV ?? source.NODE_ENV ?? "development";
  return env !== "production";
}
