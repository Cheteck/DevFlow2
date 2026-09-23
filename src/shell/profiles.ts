import type * as http from "node:http";
import type { URL } from "node:url";

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
    allowedBacs: ["identity", "solara", "spaces", "portfolio", "booking", "beam", "subscription"],
    permissions: [
      "identity:view:profile",
      "solara:read:feed",
      "solara:create:post",
      "spaces:view:dashboard",
      "portfolio:view:catalog",
      "booking:reservation:create:tenant",
      "booking:slot:read:tenant",
      "beam:send:message"
    ]
  },
  moderator: {
    id: "user-2",
    name: "Sarah K.",
    handle: "@sarah_mod",
    role: "moderator",
    roleLabel: "Modérateur",
    badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    avatar: "🛡️",
    allowedBacs: ["identity", "solara", "solidarity", "commerce", "spaces", "portfolio", "booking", "beam", "subscription"],
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
      "beam:send:message"
    ]
  },
  admin: {
    id: "user-3",
    name: "Admin Imperia",
    handle: "@admin_imperia",
    role: "admin",
    roleLabel: "Administrateur",
    badgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    avatar: "👑",
    allowedBacs: ["identity", "solara", "solidarity", "imperia", "spaces", "commerce", "beam", "portfolio", "booking", "subscription"],
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
      "beam:send:message"
    ]
  }
};

export interface SpaceProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  ownerUserRole: "member" | "moderator" | "admin";
  badge: string;
}

export const SPACES_LIST: SpaceProfile[] = [
  { id: "space-bijoux-amel", name: "Bijoux Amel", handle: "@bijoux-amel", avatar: "💍", ownerUserRole: "member", badge: "Business" },
  { id: "space-solara-lab", name: "Solara Lab", handle: "@solara-lab", avatar: "🧪", ownerUserRole: "moderator", badge: "Non-profit" },
  { id: "space-imperia-council", name: "Imperia Council", handle: "@imperia-council", avatar: "📜", ownerUserRole: "admin", badge: "Government" }
];

export function getActiveSpaceProfile(req: http.IncomingMessage, parsedUrl: URL): SpaceProfile | null {
  const spaceQuery = parsedUrl.searchParams.get("spaceId");
  if (spaceQuery) {
    const space = SPACES_LIST.find(s => s.id === spaceQuery);
    if (space) return space;
  }

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/mosaix_active_space=([a-zA-Z0-9_-]+)/);
  if (match) {
    const space = SPACES_LIST.find(s => s.id === match[1]);
    if (space) return space;
  }

  return null;
}

export function getActiveUserProfile(req: http.IncomingMessage, parsedUrl: URL): UserProfile {
  const roleQuery = parsedUrl.searchParams.get("role") || parsedUrl.searchParams.get("user");
  if (roleQuery && USER_PROFILES[roleQuery]) {
    return USER_PROFILES[roleQuery];
  }

  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/mosaix_role=([a-z_]+)/);
  if (match && USER_PROFILES[match[1]]) {
    return USER_PROFILES[match[1]];
  }

  return USER_PROFILES.member;
}
