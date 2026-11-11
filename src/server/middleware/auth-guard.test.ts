/**
 * @test — auth-guard middleware (P0.3)
 *
 * Valide l'enforcement des capacités via requireRole() :
 * - Chemin positif : utilisateur avec rôle autorisé → true, pas de réponse envoyée
 * - Chemin négatif : utilisateur sans rôle → false, 403 JSON envoyé
 * - Fail-closed : rôle vide ou undefined → 403
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type * as http from "node:http";
import { requireRole } from "./auth-guard.js";
import type { UserProfile } from "../../shell/profiles.js";

function mockRes() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = "";
  const res: Partial<http.ServerResponse> = {
    writeHead: vi.fn((code: number, hs?: Record<string, string>) => {
      statusCode = code;
      if (hs) Object.assign(headers, hs);
    }),
    end: vi.fn((content?: string) => {
      body = content ?? "";
    }),
  } as http.ServerResponse;
  return { res, statusCode: () => statusCode, headers: () => headers, body: () => body };
}

function mockUser(role: string): UserProfile {
  return {
    id: "user-1",
    name: "Test User",
    handle: "@test",
    role: role as any,
    roleLabel: role,
    badgeClass: "badge",
    avatar: "👤",
    allowedBacs: ["commerce", "portfolio"],
    permissions: [],
  };
}

describe("P0.3 — auth-guard requireRole enforcement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("chemin positif : rôle autorisé retourne true et n'envoie pas de réponse", () => {
    const { res, statusCode, body } = mockRes();
    const user = mockUser("admin");

    const result = requireRole(res as http.ServerResponse, user, ["admin", "member"]);

    expect(result).toBe(true);
    expect(res.writeHead).not.toHaveBeenCalled();
    expect(res.end).not.toHaveBeenCalled();
    expect(statusCode()).toBe(200);
    expect(body()).toBe("");
  });

  it("chemin négatif : rôle non autorisé retourne false et envoie 403", () => {
    const { res, statusCode, body, headers } = mockRes();
    const user = mockUser("member");

    const result = requireRole(res as http.ServerResponse, user, ["admin", "superadmin"]);

    expect(result).toBe(false);
    expect(res.writeHead).toHaveBeenCalledWith(403, { "Content-Type": "application/json" });
    expect(res.end).toHaveBeenCalled();
    const parsed = JSON.parse(body());
    expect(parsed.success).toBe(false);
    expect(parsed.error).toContain("Forbidden");
    expect(statusCode()).toBe(403);
  });

  it("fail-closed : liste de rôles vide rejette tout utilisateur", () => {
    const { res, statusCode, body } = mockRes();
    const user = mockUser("admin");

    const result = requireRole(res as http.ServerResponse, user, []);

    expect(result).toBe(false);
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
    expect(statusCode()).toBe(403);
    const parsed = JSON.parse(body());
    expect(parsed.success).toBe(false);
  });

  it("refus est explicabe : message JSON contient 'Forbidden'", () => {
    const { res, body } = mockRes();
    const user = mockUser("member");

    requireRole(res as http.ServerResponse, user, ["admin"]);

    const parsed = JSON.parse(body());
    expect(parsed.error).toContain("Forbidden");
    expect(parsed.error).toContain("insufficient role");
  });
});
